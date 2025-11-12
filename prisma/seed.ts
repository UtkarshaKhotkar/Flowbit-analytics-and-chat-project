import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

interface InvoiceData {
  invoice_id: string;
  vendor: {
    vendor_id: string;
    name: string;
    category: string;
  };
  customer: {
    customer_id: string;
    name: string;
    email: string;
  };
  invoice_date: string;
  due_date: string;
  total_amount: number;
  status: string;
  line_items: Array<{
    item_id: string;
    description: string;
    quantity: number;
    unit_price: number;
    total: number;
  }>;
  payments: Array<{
    payment_id: string;
    payment_date: string;
    amount: number;
    method: string;
  }>;
}

async function main() {
  console.log('🌱 Seeding database...');

  // Read JSON data
  const dataPath = path.join(__dirname, '../../../data/Analytics_Test_Data.json');
  const rawData = fs.readFileSync(dataPath, 'utf-8');
  const invoicesData: InvoiceData[] = JSON.parse(rawData);

  // Clear existing data
  await prisma.payment.deleteMany();
  await prisma.lineItem.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.vendor.deleteMany();
  await prisma.customer.deleteMany();

  console.log('📦 Creating vendors and customers...');

  // Create unique vendors and customers
  const vendorMap = new Map<string, { vendor_id: string; name: string; category: string }>();
  const customerMap = new Map<string, { customer_id: string; name: string; email: string }>();

  invoicesData.forEach(inv => {
    vendorMap.set(inv.vendor.vendor_id, inv.vendor);
    customerMap.set(inv.customer.customer_id, inv.customer);
  });

  // Create vendors
  for (const vendor of vendorMap.values()) {
    await prisma.vendor.upsert({
      where: { vendorId: vendor.vendor_id },
      update: {
        name: vendor.name,
        category: vendor.category
      },
      create: {
        vendorId: vendor.vendor_id,
        name: vendor.name,
        category: vendor.category
      }
    });
  }

  // Create customers
  for (const customer of customerMap.values()) {
    await prisma.customer.upsert({
      where: { customerId: customer.customer_id },
      update: {
        name: customer.name,
        email: customer.email
      },
      create: {
        customerId: customer.customer_id,
        name: customer.name,
        email: customer.email
      }
    });
  }

  console.log('📄 Creating invoices...');

  // Create invoices with line items and payments
  for (const invData of invoicesData) {
    const invoice = await prisma.invoice.create({
      data: {
        invoiceId: invData.invoice_id,
        vendorId: invData.vendor.vendor_id,
        customerId: invData.customer.customer_id,
        invoiceDate: new Date(invData.invoice_date),
        dueDate: new Date(invData.due_date),
        totalAmount: invData.total_amount,
        status: invData.status,
        lineItems: {
          create: invData.line_items.map(item => ({
            itemId: item.item_id,
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unit_price,
            total: item.total
          }))
        },
        payments: {
          create: invData.payments.map(payment => ({
            paymentId: payment.payment_id,
            paymentDate: new Date(payment.payment_date),
            amount: payment.amount,
            method: payment.method
          }))
        }
      }
    });

    console.log(`  ✓ Created invoice ${invoice.invoiceId}`);
  }

  console.log('✅ Seeding completed!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

