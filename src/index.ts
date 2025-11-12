import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import rateLimit from 'express-rate-limit';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use('/api/', limiter);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Dashboard Stats
app.get('/api/stats', async (req, res) => {
  try {
    const currentYear = new Date().getFullYear();
    const startOfYear = new Date(currentYear, 0, 1);
    const endOfYear = new Date(currentYear, 11, 31, 23, 59, 59);

    // Total Spend YTD
    const totalSpend = await prisma.invoice.aggregate({
      where: {
        invoiceDate: {
          gte: startOfYear,
          lte: endOfYear
        }
      },
      _sum: {
        totalAmount: true
      }
    });

    // Total Invoices Processed
    const totalInvoices = await prisma.invoice.count({
      where: {
        invoiceDate: {
          gte: startOfYear,
          lte: endOfYear
        }
      }
    });

    // Documents Uploaded (total invoices)
    const documentsUploaded = await prisma.invoice.count();

    // Average Invoice Value
    const avgInvoice = await prisma.invoice.aggregate({
      _avg: {
        totalAmount: true
      }
    });

    res.json({
      totalSpendYTD: totalSpend._sum.totalAmount || 0,
      totalInvoicesProcessed: totalInvoices,
      documentsUploaded,
      averageInvoiceValue: avgInvoice._avg.totalAmount || 0
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// Invoice Trends
app.get('/api/invoice-trends', async (req, res) => {
  try {
    const invoices = await prisma.invoice.findMany({
      select: {
        invoiceDate: true,
        totalAmount: true
      },
      orderBy: {
        invoiceDate: 'asc'
      }
    });

    // Group by month
    const monthlyData: Record<string, { count: number; spend: number }> = {};
    
    invoices.forEach(invoice => {
      const month = invoice.invoiceDate.toISOString().substring(0, 7); // YYYY-MM
      if (!monthlyData[month]) {
        monthlyData[month] = { count: 0, spend: 0 };
      }
      monthlyData[month].count += 1;
      monthlyData[month].spend += Number(invoice.totalAmount);
    });

    const trends = Object.entries(monthlyData).map(([month, data]) => ({
      month,
      invoiceCount: data.count,
      totalSpend: data.spend
    }));

    res.json(trends);
  } catch (error) {
    console.error('Error fetching invoice trends:', error);
    res.status(500).json({ error: 'Failed to fetch invoice trends' });
  }
});

// Top 10 Vendors
app.get('/api/vendors/top10', async (req, res) => {
  try {
    const vendors = await prisma.vendor.findMany({
      include: {
        invoices: {
          select: {
            totalAmount: true
          }
        }
      }
    });

    const vendorSpend = vendors.map(vendor => ({
      vendorId: vendor.vendorId,
      name: vendor.name,
      category: vendor.category,
      totalSpend: vendor.invoices.reduce((sum, inv) => sum + Number(inv.totalAmount), 0)
    }));

    vendorSpend.sort((a, b) => b.totalSpend - a.totalSpend);

    res.json(vendorSpend.slice(0, 10));
  } catch (error) {
    console.error('Error fetching top vendors:', error);
    res.status(500).json({ error: 'Failed to fetch top vendors' });
  }
});

// Category Spend
app.get('/api/category-spend', async (req, res) => {
  try {
    const vendors = await prisma.vendor.findMany({
      include: {
        invoices: {
          select: {
            totalAmount: true
          }
        }
      }
    });

    const categorySpend: Record<string, number> = {};

    vendors.forEach(vendor => {
      const spend = vendor.invoices.reduce((sum, inv) => sum + Number(inv.totalAmount), 0);
      if (!categorySpend[vendor.category]) {
        categorySpend[vendor.category] = 0;
      }
      categorySpend[vendor.category] += spend;
    });

    const result = Object.entries(categorySpend).map(([category, spend]) => ({
      category,
      spend
    }));

    res.json(result);
  } catch (error) {
    console.error('Error fetching category spend:', error);
    res.status(500).json({ error: 'Failed to fetch category spend' });
  }
});

// Cash Outflow Forecast
app.get('/api/cash-outflow', async (req, res) => {
  try {
    const pendingInvoices = await prisma.invoice.findMany({
      where: {
        status: 'pending'
      },
      select: {
        dueDate: true,
        totalAmount: true
      },
      orderBy: {
        dueDate: 'asc'
      }
    });

    // Group by month
    const monthlyOutflow: Record<string, number> = {};

    pendingInvoices.forEach(invoice => {
      const month = invoice.dueDate.toISOString().substring(0, 7);
      if (!monthlyOutflow[month]) {
        monthlyOutflow[month] = 0;
      }
      monthlyOutflow[month] += Number(invoice.totalAmount);
    });

    const forecast = Object.entries(monthlyOutflow).map(([month, amount]) => ({
      month,
      amount
    }));

    res.json(forecast);
  } catch (error) {
    console.error('Error fetching cash outflow:', error);
    res.status(500).json({ error: 'Failed to fetch cash outflow forecast' });
  }
});

// Invoices (Paginated + Searchable)
app.get('/api/invoices', async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const search = req.query.search as string || '';
    const skip = (page - 1) * limit;

    const where: any = {};

    if (search) {
      where.OR = [
        { invoiceId: { contains: search, mode: 'insensitive' } },
        { vendor: { name: { contains: search, mode: 'insensitive' } } },
        { customer: { name: { contains: search, mode: 'insensitive' } } }
      ];
    }

    const [invoices, total] = await Promise.all([
      prisma.invoice.findMany({
        where,
        include: {
          vendor: {
            select: {
              name: true,
              vendorId: true
            }
          },
          customer: {
            select: {
              name: true,
              customerId: true
            }
          }
        },
        orderBy: {
          invoiceDate: 'desc'
        },
        skip,
        take: limit
      }),
      prisma.invoice.count({ where })
    ]);

    const formattedInvoices = invoices.map(inv => ({
      id: inv.id,
      invoiceId: inv.invoiceId,
      vendor: inv.vendor.name,
      vendorId: inv.vendor.vendorId,
      customer: inv.customer.name,
      customerId: inv.customer.customerId,
      date: inv.invoiceDate.toISOString().split('T')[0],
      amount: Number(inv.totalAmount),
      status: inv.status
    }));

    res.json({
      invoices: formattedInvoices,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching invoices:', error);
    res.status(500).json({ error: 'Failed to fetch invoices' });
  }
});

// Get Invoice Details (with line items and payments)
app.get('/api/invoices/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const invoice = await prisma.invoice.findUnique({
      where: { invoiceId: id },
      include: {
        vendor: true,
        customer: true,
        lineItems: true,
        payments: true
      }
    });

    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    res.json({
      id: invoice.id,
      invoiceId: invoice.invoiceId,
      vendor: {
        id: invoice.vendor.id,
        vendorId: invoice.vendor.vendorId,
        name: invoice.vendor.name,
        category: invoice.vendor.category
      },
      customer: {
        id: invoice.customer.id,
        customerId: invoice.customer.customerId,
        name: invoice.customer.name,
        email: invoice.customer.email
      },
      invoiceDate: invoice.invoiceDate.toISOString().split('T')[0],
      dueDate: invoice.dueDate.toISOString().split('T')[0],
      totalAmount: Number(invoice.totalAmount),
      status: invoice.status,
      lineItems: invoice.lineItems.map(item => ({
        id: item.id,
        itemId: item.itemId,
        description: item.description,
        quantity: item.quantity,
        unitPrice: Number(item.unitPrice),
        total: Number(item.total)
      })),
      payments: invoice.payments.map(payment => ({
        id: payment.id,
        paymentId: payment.paymentId,
        paymentDate: payment.paymentDate.toISOString().split('T')[0],
        amount: Number(payment.amount),
        method: payment.method
      })),
      createdAt: invoice.createdAt.toISOString(),
      updatedAt: invoice.updatedAt.toISOString()
    });
  } catch (error) {
    console.error('Error fetching invoice details:', error);
    res.status(500).json({ error: 'Failed to fetch invoice details' });
  }
});

// Chat with Data - Proxy to Vanna AI
app.post('/api/chat-with-data', async (req, res) => {
  try {
    const { query } = req.body;

    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'Query is required' });
    }

    const vannaApiUrl = process.env.VANNA_API_BASE_URL || 'http://localhost:8000';
    const vannaApiKey = process.env.VANNA_API_KEY;

    const response = await fetch(`${vannaApiUrl}/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(vannaApiKey && { 'Authorization': `Bearer ${vannaApiKey}` })
      },
      body: JSON.stringify({ query })
    });

    if (!response.ok) {
      throw new Error(`Vanna API error: ${response.statusText}`);
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Error in chat-with-data:', error);
    res.status(500).json({ 
      error: 'Failed to process query',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 API server running on http://localhost:${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  await prisma.$disconnect();
  process.exit(0);
});

