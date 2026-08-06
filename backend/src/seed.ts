import { NestFactory } from '@nestjs/core';
import { DataSource, DeepPartial } from 'typeorm';
import { AppModule } from './app.module';
import { companies, costCenters, orgUnits } from './organization-data';
import { Company } from './modules/master-data/entities/company.entity';
import { CostCenter } from './modules/master-data/entities/cost-center.entity';
import { DimensionBudget } from './modules/master-data/entities/dimension-budget.entity';
import { OrgUnit } from './modules/master-data/entities/org-unit.entity';
import { SpendCategory } from './modules/master-data/entities/spend-category.entity';
import { Supplier } from './modules/master-data/entities/supplier.entity';
import { BankAccountChange } from './modules/master-data/entities/bank-account-change.entity';
import { Contract } from './modules/master-data/entities/contract.entity';
import { PurchaseOrder } from './modules/master-data/entities/purchase-order.entity';
import { ToleranceProfile } from './modules/master-data/entities/tolerance-profile.entity';
import { SupplierBudget } from './modules/master-data/entities/supplier-budget.entity';
import { CreateInvoiceDto } from './modules/invoices/dto/create-invoice.dto';
import { InvoicesService } from './modules/invoices/services/invoices.service';
import {
  SYNTHETIC_INVOICES_PER_SUPPLIER,
  SYNTHETIC_SUPPLIER_COUNT,
  buildSyntheticDataset,
} from './synthetic-data';

const categories: DeepPartial<SpendCategory>[] = [
  {
    code: 'IT-CLOUD',
    name: 'Cloud e infraestructura',
    level: 2,
    parentCode: 'IT',
    glAccount: '628100',
    keywords: ['cloud', 'aws', 'azure', 'gcp', 'iaas', 'kubernetes', 'hosting', 'almacenamiento', 'computo'],
  },
  {
    code: 'IT-SAAS',
    name: 'Licencias y suscripciones SaaS',
    level: 2,
    parentCode: 'IT',
    glAccount: '628200',
    keywords: ['licencia', 'licencias', 'suscripcion', 'saas', 'subscription', 'office', 'jira', 'crm'],
  },
  {
    code: 'IT-SOFT-MAINT',
    name: 'Mantenimiento y soporte software',
    level: 2,
    parentCode: 'IT',
    glAccount: '628300',
    keywords: ['mantenimiento', 'soporte', 'support', 'sla', 'garantia software'],
  },
  {
    code: 'IT-HARDWARE',
    name: 'Hardware y equipamiento',
    level: 2,
    parentCode: 'IT',
    glAccount: '217000',
    keywords: ['portatil', 'laptop', 'servidor', 'monitor', 'switch', 'router', 'hardware', 'equipo'],
  },
  {
    code: 'IT-TELCO',
    name: 'Telecomunicaciones y conectividad',
    level: 2,
    parentCode: 'IT',
    glAccount: '629100',
    keywords: ['telefonia', 'movil', 'moviles', 'fibra', 'mpls', 'internet', 'lineas', 'telco'],
  },
  {
    code: 'IT-SERVICES',
    name: 'Servicios profesionales IT',
    level: 2,
    parentCode: 'IT',
    glAccount: '623000',
    keywords: ['consultoria', 'desarrollo', 'implantacion', 'horas', 'jornada', 'proyecto', 'staffing'],
  },
  {
    code: 'IT-SECURITY',
    name: 'Ciberseguridad',
    level: 2,
    parentCode: 'IT',
    glAccount: '628400',
    keywords: ['seguridad', 'pentest', 'siem', 'antivirus', 'edr', 'vulnerabilidades'],
  },
  {
    code: 'GEN-FACILITIES',
    name: 'Servicios generales e instalaciones',
    level: 2,
    parentCode: 'GEN',
    glAccount: '621000',
    keywords: ['limpieza', 'suministro electrico', 'agua', 'alquiler', 'oficina'],
  },
  {
    code: 'GEN-MARKETING',
    name: 'Marketing y publicidad',
    level: 2,
    parentCode: 'GEN',
    glAccount: '627000',
    keywords: ['campana', 'publicidad', 'marketing', 'eventos', 'branding', 'medios'],
  },
  {
    code: 'GEN-OTHER',
    name: 'Otros gastos no clasificados',
    level: 2,
    parentCode: 'GEN',
    glAccount: '629900',
    keywords: [],
  },
];

const suppliers: DeepPartial<Supplier>[] = [
  {
    id: 'sup-001',
    taxId: 'B12345678',
    legalName: 'Nimbus Cloud Services S.L.',
    tradeName: 'Nimbus Cloud',
    country: 'ES',
    status: 'active',
    defaultCategoryCode: 'IT-CLOUD',
    paymentTermsDays: 60,
    onboardedAt: new Date('2019-03-11'),
    riskScore: 12,
    contactEmail: 'facturacion@nimbuscloud.example',
    bankAccounts: [
      {
        id: 'acc-001',
        supplierId: 'sup-001',
        iban: 'ES9121000418450200051332',
        bic: 'CAIXESBBXXX',
        holderName: 'Nimbus Cloud Services S.L.',
        status: 'verified',
        isPrimary: true,
        registeredAt: new Date('2019-03-12'),
        verifiedAt: new Date('2019-03-15'),
        verifiedBy: 'compras.masterdata',
        verificationChannel: 'callback',
      },
    ],
  },
  {
    id: 'sup-002',
    taxId: 'A87654321',
    legalName: 'Delta Software Licensing S.A.',
    country: 'ES',
    status: 'active',
    defaultCategoryCode: 'IT-SAAS',
    paymentTermsDays: 30,
    onboardedAt: new Date('2021-07-01'),
    riskScore: 22,
    contactEmail: 'billing@deltasoft.example',
    bankAccounts: [
      {
        id: 'acc-002',
        supplierId: 'sup-002',
        iban: 'ES7920770024003102575766',
        holderName: 'Delta Software Licensing S.A.',
        status: 'verified',
        isPrimary: true,
        registeredAt: new Date('2021-07-02'),
        verifiedAt: new Date('2021-07-10'),
        verifiedBy: 'compras.masterdata',
        verificationChannel: 'certificate',
      },
      {
        id: 'acc-003',
        supplierId: 'sup-002',
        iban: 'LT601010012345678901',
        holderName: 'Delta Soft Ltd',
        status: 'pending_verification',
        isPrimary: false,
        registeredAt: new Date('2026-07-20'),
        verificationChannel: 'none',
      },
    ],
  },
  {
    id: 'sup-003',
    taxId: 'B55512399',
    legalName: 'Consultoria Orion S.L.',
    country: 'ES',
    status: 'active',
    defaultCategoryCode: 'IT-SERVICES',
    paymentTermsDays: 45,
    onboardedAt: new Date('2024-11-05'),
    riskScore: 35,
    contactEmail: 'admin@orion-it.example',
    bankAccounts: [
      {
        id: 'acc-004',
        supplierId: 'sup-003',
        iban: 'ES6000491500051234567892',
        holderName: 'Consultoria Orion S.L.',
        status: 'verified',
        isPrimary: true,
        registeredAt: new Date('2024-11-06'),
        verifiedAt: new Date('2024-11-12'),
        verifiedBy: 'compras.masterdata',
        verificationChannel: 'portal',
      },
    ],
  },
  {
    id: 'sup-004',
    taxId: 'B99988877',
    legalName: 'Telered Comunicaciones S.L.',
    country: 'ES',
    status: 'active',
    defaultCategoryCode: 'IT-TELCO',
    paymentTermsDays: 30,
    onboardedAt: new Date('2026-06-15'),
    riskScore: 58,
    contactEmail: 'facturas@telered.example',
    bankAccounts: [
      {
        id: 'acc-005',
        supplierId: 'sup-004',
        iban: 'ES1000751234560123456789',
        holderName: 'Telered Comunicaciones S.L.',
        status: 'verified',
        isPrimary: true,
        registeredAt: new Date('2026-06-16'),
        verifiedAt: new Date('2026-06-20'),
        verifiedBy: 'compras.masterdata',
        verificationChannel: 'callback',
      },
    ],
  },
];

const bankAccountChanges: DeepPartial<BankAccountChange>[] = [
  {
    id: 'bac-001',
    supplierId: 'sup-002',
    previousAccountId: 'acc-002',
    newAccountId: 'acc-003',
    previousIbanMasked: 'ES79****5766',
    newIbanMasked: 'LT60****8901',
    changedAt: new Date('2026-07-20'),
    changedBy: 'buzon.facturas',
    requestChannel: 'email',
    verified: false,
  },
];

const contracts: DeepPartial<Contract>[] = [
  {
    id: 'ctr-001',
    supplierId: 'sup-001',
    reference: 'CTR-CLOUD-2026',
    categoryCode: 'IT-CLOUD',
    validFrom: new Date('2026-01-01'),
    validUntil: new Date('2026-12-31'),
    committedAnnualSpend: 480000,
    currency: 'EUR',
    paymentTermsDays: 60,
    earlyPaymentDiscountPercent: 1.5,
    autoRenew: true,
    status: 'active',
    description: 'Contrato marco de servicios cloud para tecnologia de las dos sociedades espanolas',
    scopes: [
      { id: 'cts-001', contractId: 'ctr-001', companyId: 'co-es01', orgUnitId: 'ou-es01-tec' },
      { id: 'cts-002', contractId: 'ctr-001', companyId: 'co-es03', orgUnitId: 'ou-es03-tec' },
    ],
    priceList: [
      {
        id: 'ctp-001',
        contractId: 'ctr-001',
        itemCode: 'CLOUD-VM-M',
        description: 'Instancia computo mediana',
        unitPrice: 120,
        uom: 'unidad/mes',
      },
      {
        id: 'ctp-002',
        contractId: 'ctr-001',
        itemCode: 'CLOUD-STG-TB',
        description: 'Almacenamiento objeto',
        unitPrice: 18,
        uom: 'TB/mes',
      },
    ],
  },
  {
    id: 'ctr-002',
    supplierId: 'sup-002',
    reference: 'CTR-SAAS-2026',
    categoryCode: 'IT-SAAS',
    validFrom: new Date('2026-02-01'),
    validUntil: new Date('2027-01-31'),
    committedAnnualSpend: 210000,
    currency: 'EUR',
    paymentTermsDays: 30,
    autoRenew: false,
    status: 'active',
    description: 'Licencias corporativas con alcance a todas las areas de la sociedad matriz',
    scopes: [{ id: 'cts-003', contractId: 'ctr-002', companyId: 'co-es01' }],
    priceList: [
      {
        id: 'ctp-003',
        contractId: 'ctr-002',
        itemCode: 'LIC-CRM-USR',
        description: 'Licencia CRM por usuario',
        unitPrice: 45,
        uom: 'usuario/mes',
      },
    ],
  },
  {
    id: 'ctr-003',
    supplierId: 'sup-003',
    reference: 'CTR-SERV-2026',
    categoryCode: 'IT-SERVICES',
    validFrom: new Date('2026-01-15'),
    validUntil: new Date('2026-12-31'),
    committedAnnualSpend: 150000,
    currency: 'EUR',
    paymentTermsDays: 45,
    autoRenew: false,
    status: 'active',
    description: 'Bolsa de servicios profesionales para aplicaciones y operaciones',
    scopes: [
      { id: 'cts-004', contractId: 'ctr-003', companyId: 'co-es01', orgUnitId: 'ou-es01-tec' },
      { id: 'cts-005', contractId: 'ctr-003', companyId: 'co-es01', orgUnitId: 'ou-es01-ops' },
    ],
    priceList: [
      {
        id: 'ctp-004',
        contractId: 'ctr-003',
        itemCode: 'SRV-DEV-SR',
        description: 'Jornada desarrollador senior',
        unitPrice: 520,
        uom: 'jornada',
      },
    ],
  },
];

const purchaseOrders: DeepPartial<PurchaseOrder>[] = [
  {
    id: 'po-001',
    number: 'PO-2026-0453',
    supplierId: 'sup-001',
    contractId: 'ctr-001',
    currency: 'EUR',
    issuedAt: new Date('2026-06-01'),
    costCenter: 'CC-ES01-IT-INFRA',
    approvedAmount: 40000,
    status: 'partially_received',
    lines: [
      {
        id: 'pol-001',
        purchaseOrderId: 'po-001',
        lineNumber: 1,
        itemCode: 'CLOUD-VM-M',
        description: 'Instancia computo mediana',
        quantity: 200,
        uom: 'unidad/mes',
        unitPrice: 120,
        categoryCode: 'IT-CLOUD',
        receivedQuantity: 200,
        invoicedQuantity: 100,
      },
      {
        id: 'pol-002',
        purchaseOrderId: 'po-001',
        lineNumber: 2,
        itemCode: 'CLOUD-STG-TB',
        description: 'Almacenamiento objeto',
        quantity: 500,
        uom: 'TB/mes',
        unitPrice: 18,
        categoryCode: 'IT-CLOUD',
        receivedQuantity: 500,
        invoicedQuantity: 250,
      },
    ],
  },
  {
    id: 'po-002',
    number: 'PO-2026-0511',
    supplierId: 'sup-002',
    contractId: 'ctr-002',
    currency: 'EUR',
    issuedAt: new Date('2026-06-20'),
    costCenter: 'CC-ES01-IT-APPS',
    approvedAmount: 27000,
    status: 'open',
    lines: [
      {
        id: 'pol-003',
        purchaseOrderId: 'po-002',
        lineNumber: 1,
        itemCode: 'LIC-CRM-USR',
        description: 'Licencia CRM por usuario',
        quantity: 600,
        uom: 'usuario/mes',
        unitPrice: 45,
        categoryCode: 'IT-SAAS',
        receivedQuantity: 600,
        invoicedQuantity: 0,
      },
    ],
  },
  {
    id: 'po-003',
    number: 'PO-2026-0602',
    supplierId: 'sup-003',
    contractId: 'ctr-003',
    currency: 'EUR',
    issuedAt: new Date('2026-07-01'),
    costCenter: 'CC-ES01-IT-APPS',
    approvedAmount: 52000,
    status: 'open',
    lines: [
      {
        id: 'pol-004',
        purchaseOrderId: 'po-003',
        lineNumber: 1,
        itemCode: 'SRV-DEV-SR',
        description: 'Jornada desarrollador senior',
        quantity: 100,
        uom: 'jornada',
        unitPrice: 520,
        categoryCode: 'IT-SERVICES',
        receivedQuantity: 60,
        invoicedQuantity: 0,
      },
    ],
  },
];

const toleranceProfile: DeepPartial<ToleranceProfile> = {
  id: 'tol-default',
  name: 'Perfil de tolerancias compras IT',
  currency: 'EUR',
  approvalThreshold: 15000,
  rules: [
    { id: 'tr-01', profileId: 'tol-default', ruleCode: 'DUPLICATE_EXACT', enabled: true, threshold: 0, unit: 'count', severity: 'critical', blocksPayment: true },
    { id: 'tr-02', profileId: 'tol-default', ruleCode: 'DUPLICATE_FUZZY', enabled: true, threshold: 70, unit: 'percent', severity: 'high', blocksPayment: true },
    { id: 'tr-03', profileId: 'tol-default', ruleCode: 'BANK_ACCOUNT_UNKNOWN', enabled: true, threshold: 0, unit: 'count', severity: 'critical', blocksPayment: true },
    { id: 'tr-04', profileId: 'tol-default', ruleCode: 'BANK_ACCOUNT_RECENT_CHANGE', enabled: true, threshold: 30, unit: 'days', severity: 'high', blocksPayment: true },
    { id: 'tr-05', profileId: 'tol-default', ruleCode: 'PRICE_DEVIATION_CONTRACT', enabled: true, threshold: 5, unit: 'percent', severity: 'medium', blocksPayment: false },
    { id: 'tr-06', profileId: 'tol-default', ruleCode: 'PO_AMOUNT_VARIANCE', enabled: true, threshold: 2, unit: 'percent', severity: 'medium', blocksPayment: false },
    { id: 'tr-07', profileId: 'tol-default', ruleCode: 'PO_MISSING', enabled: true, threshold: 3000, unit: 'amount', severity: 'medium', blocksPayment: false },
    { id: 'tr-08', profileId: 'tol-default', ruleCode: 'TOTALS_MISMATCH', enabled: true, threshold: 1, unit: 'amount', severity: 'high', blocksPayment: true },
    { id: 'tr-09', profileId: 'tol-default', ruleCode: 'TAX_MISMATCH', enabled: true, threshold: 1, unit: 'amount', severity: 'medium', blocksPayment: false },
    { id: 'tr-10', profileId: 'tol-default', ruleCode: 'THRESHOLD_SPLITTING', enabled: true, threshold: 5, unit: 'percent', severity: 'high', blocksPayment: false },
    { id: 'tr-11', profileId: 'tol-default', ruleCode: 'ROUND_AMOUNT', enabled: true, threshold: 10000, unit: 'amount', severity: 'low', blocksPayment: false },
    { id: 'tr-12', profileId: 'tol-default', ruleCode: 'AMOUNT_OUTLIER_HISTORY', enabled: true, threshold: 50, unit: 'percent', severity: 'medium', blocksPayment: false },
    { id: 'tr-13', profileId: 'tol-default', ruleCode: 'NEW_SUPPLIER_HIGH_AMOUNT', enabled: true, threshold: 10000, unit: 'amount', severity: 'high', blocksPayment: true },
    { id: 'tr-14', profileId: 'tol-default', ruleCode: 'PAYMENT_TERMS_MISMATCH', enabled: true, threshold: 5, unit: 'days', severity: 'low', blocksPayment: false },
    { id: 'tr-15', profileId: 'tol-default', ruleCode: 'CURRENCY_MISMATCH', enabled: true, threshold: 0, unit: 'count', severity: 'medium', blocksPayment: false },
    { id: 'tr-16', profileId: 'tol-default', ruleCode: 'BACKDATED_INVOICE', enabled: true, threshold: 90, unit: 'days', severity: 'low', blocksPayment: false },
    { id: 'tr-17', profileId: 'tol-default', ruleCode: 'LOW_CLASSIFICATION_CONFIDENCE', enabled: true, threshold: 60, unit: 'percent', severity: 'low', blocksPayment: false },
  ],
};

/**
 * Facturas de ejemplo elegidas para que cada control quede visible:
 * duplicado exacto, cuenta bancaria recien registrada, sobreprecio de contrato,
 * gasto sin PO justo bajo el umbral y proveedor recien dado de alta.
 */
const invoices: CreateInvoiceDto[] = [
  {
    invoiceNumber: 'NIM-2026-0741',
    supplierId: 'sup-001',
    purchaseOrderNumber: 'PO-2026-0453',
    contractReference: 'CTR-CLOUD-2026',
    issueDate: '2026-07-01',
    receivedDate: '2026-07-03',
    dueDate: '2026-08-30',
    currency: 'EUR',
    exchangeRate: 1,
    taxRate: 21,
    paymentTermsDays: 60,
    paymentMethod: 'transfer',
    bankAccountIban: 'ES9121000418450200051332',
    bankAccountHolder: 'Nimbus Cloud Services S.L.',
    costCenter: 'CC-ES01-IT-INFRA',
    requesterEmail: 'infra.lead@empresa.example',
    description: 'Servicios cloud junio 2026',
    source: 'edi',
    allocations: [
      { costCenterCode: 'CC-ES01-IT-INFRA', mode: 'percent', value: 70 },
      { costCenterCode: 'CC-ES03-IT-INFRA', mode: 'percent', value: 30 },
    ],
    lines: [
      { itemCode: 'CLOUD-VM-M', description: 'Instancia computo mediana', quantity: 100, uom: 'unidad/mes', unitPrice: 120, taxRate: 21 },
      { itemCode: 'CLOUD-STG-TB', description: 'Almacenamiento objeto', quantity: 250, uom: 'TB/mes', unitPrice: 18, taxRate: 21 },
    ],
  },
  {
    invoiceNumber: 'NIM 2026 0741',
    supplierId: 'sup-001',
    purchaseOrderNumber: 'PO-2026-0453',
    contractReference: 'CTR-CLOUD-2026',
    issueDate: '2026-07-01',
    receivedDate: '2026-07-18',
    dueDate: '2026-08-30',
    currency: 'EUR',
    exchangeRate: 1,
    taxRate: 21,
    paymentTermsDays: 60,
    paymentMethod: 'transfer',
    bankAccountIban: 'ES9121000418450200051332',
    bankAccountHolder: 'Nimbus Cloud Services S.L.',
    costCenter: 'CC-ES01-IT-INFRA',
    description: 'Servicios cloud junio 2026 (reenvio del proveedor)',
    source: 'email',
    allocations: [
      { costCenterCode: 'CC-ES01-IT-INFRA', mode: 'percent', value: 70 },
      { costCenterCode: 'CC-ES03-IT-INFRA', mode: 'percent', value: 30 },
    ],
    lines: [
      { itemCode: 'CLOUD-VM-M', description: 'Instancia computo mediana', quantity: 100, uom: 'unidad/mes', unitPrice: 120, taxRate: 21 },
      { itemCode: 'CLOUD-STG-TB', description: 'Almacenamiento objeto', quantity: 250, uom: 'TB/mes', unitPrice: 18, taxRate: 21 },
    ],
  },
  {
    invoiceNumber: 'DS-9931',
    supplierId: 'sup-002',
    purchaseOrderNumber: 'PO-2026-0511',
    contractReference: 'CTR-SAAS-2026',
    issueDate: '2026-07-10',
    receivedDate: '2026-07-28',
    dueDate: '2026-08-09',
    currency: 'EUR',
    exchangeRate: 1,
    taxRate: 21,
    paymentTermsDays: 30,
    paymentMethod: 'transfer',
    bankAccountIban: 'LT601010012345678901',
    bankAccountHolder: 'Delta Soft Ltd',
    costCenter: 'CC-ES01-IT-APPS',
    description: 'Renovacion licencias CRM Q3',
    source: 'email',
    lines: [
      { itemCode: 'LIC-CRM-USR', description: 'Licencia CRM por usuario', quantity: 600, uom: 'usuario/mes', unitPrice: 52, taxRate: 21 },
    ],
  },
  {
    invoiceNumber: 'ORI-2026-118',
    supplierId: 'sup-003',
    issueDate: '2026-07-20',
    receivedDate: '2026-07-22',
    dueDate: '2026-09-05',
    currency: 'EUR',
    exchangeRate: 1,
    taxRate: 21,
    paymentTermsDays: 45,
    paymentMethod: 'transfer',
    bankAccountIban: 'ES6000491500051234567892',
    bankAccountHolder: 'Consultoria Orion S.L.',
    costCenter: 'CC-ES01-IT-APPS',
    description: 'Bolsa de horas de desarrollo julio',
    source: 'manual',
    lines: [
      { itemCode: 'SRV-DEV-SR', description: 'Jornada desarrollador senior', quantity: 22, uom: 'jornada', unitPrice: 545, taxRate: 21 },
    ],
  },
  {
    invoiceNumber: 'DS-9948',
    supplierId: 'sup-002',
    issueDate: '2026-07-18',
    receivedDate: '2026-07-19',
    dueDate: '2026-08-17',
    currency: 'EUR',
    exchangeRate: 1,
    taxRate: 21,
    paymentTermsDays: 30,
    paymentMethod: 'transfer',
    bankAccountIban: 'ES7920770024003102575766',
    bankAccountHolder: 'Delta Software Licensing S.A.',
    costCenter: 'CC-ES01-IT-APPS',
    description: 'Consultoria de implantacion del modulo de facturacion',
    source: 'manual',
    lines: [
      { description: 'Jornada consultoria implantacion', quantity: 12, uom: 'jornada', unitPrice: 610, taxRate: 21 },
    ],
  },
  {
    invoiceNumber: 'TR-2026-0004',
    supplierId: 'sup-004',
    issueDate: '2026-07-25',
    receivedDate: '2026-07-26',
    dueDate: '2026-08-25',
    currency: 'EUR',
    exchangeRate: 1,
    taxRate: 21,
    paymentTermsDays: 30,
    paymentMethod: 'transfer',
    bankAccountIban: 'ES1000751234560123456789',
    bankAccountHolder: 'Telered Comunicaciones S.L.',
    costCenter: 'CC-ES01-IT-INFRA',
    description: 'Lineas moviles y fibra corporativa',
    source: 'supplier_portal',
    allocations: [
      { costCenterCode: 'CC-ES01-IT-INFRA', mode: 'percent', value: 50 },
      { costCenterCode: 'CC-ES02-OPS', mode: 'percent', value: 30 },
      { costCenterCode: 'CC-ES01-FAC', mode: 'percent', value: 20 },
    ],
    lines: [
      { description: 'Lineas moviles datos corporativos', quantity: 400, uom: 'linea/mes', unitPrice: 29, taxRate: 21 },
      { description: 'Fibra dedicada sede central', quantity: 1, uom: 'mes', unitPrice: 2600, taxRate: 21 },
    ],
  },
];

async function seed() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  const dataSource = app.get(DataSource);

  await dataSource.query(
    'TRUNCATE TABLE audit_events, duplicate_candidates, invoice_exceptions, invoice_allocations, ' +
      'invoice_lines, invoices, tolerance_rules, tolerance_profiles, purchase_order_lines, ' +
      'purchase_orders, contract_prices, contract_scopes, contracts, bank_account_changes, ' +
      'supplier_bank_accounts, supplier_budgets, dimension_budgets, suppliers, cost_centers, ' +
      'org_units, companies, spend_categories CASCADE',
  );

  await dataSource.getRepository(SpendCategory).save(categories);
  await dataSource.getRepository(Company).save(companies);
  await dataSource.getRepository(OrgUnit).save(orgUnits);
  await dataSource.getRepository(CostCenter).save(costCenters);
  await dataSource.getRepository(Supplier).save(suppliers);
  await dataSource.getRepository(BankAccountChange).save(bankAccountChanges);
  await dataSource.getRepository(Contract).save(contracts);
  await dataSource.getRepository(PurchaseOrder).save(purchaseOrders);
  await dataSource.getRepository(ToleranceProfile).save(toleranceProfile);

  const invoicesService = app.get(InvoicesService);
  for (const invoice of invoices) {
    const created = await invoicesService.create(invoice);
    console.log(
      `${created.invoiceNumber}: ${created.status} | riesgo ${created.riskScore} | ` +
        `${created.exceptions.length} excepcion(es)`,
    );
  }

  const budgets: DeepPartial<SupplierBudget>[] = suppliers.flatMap((supplier, index) =>
    [2024, 2025, 2026].map((year) => ({
      id: `bud-${supplier.id}-${year}`,
      supplierId: supplier.id,
      fiscalYear: year,
      budgetAmount: [180000, 420000, 260000, 320000][index % 4],
      currency: 'EUR',
      categoryCode: supplier.defaultCategoryCode,
      alertThresholdPercent: 85,
      ownerEmail: 'categoria.it@empresa.example',
      notes: `Presupuesto ${year} de la categoria ${supplier.defaultCategoryCode}`,
    })),
  );
  await dataSource.getRepository(SupplierBudget).save(budgets);

  await seedSyntheticVolume(dataSource, invoicesService, suppliers.length);

  await app.close();
  console.log('Seed completado');
}

/**
 * Volumen sintetico para trabajar con datos realistas: 50 proveedores adicionales,
 * presupuesto por ejercicio y 100 facturas por proveedor evaluadas con el mismo motor
 * de tolerancias que el alta manual (persistidas por lotes para que sea viable).
 */
async function seedSyntheticVolume(
  dataSource: DataSource,
  invoicesService: InvoicesService,
  existingSupplierCount: number,
): Promise<void> {
  const dataset = buildSyntheticDataset(existingSupplierCount);

  await dataSource.getRepository(Supplier).save(dataset.suppliers, { chunk: 25 });
  await dataSource.getRepository(BankAccountChange).save(dataset.bankAccountChanges, { chunk: 25 });
  await dataSource.getRepository(SupplierBudget).save(dataset.budgets, { chunk: 50 });
  await dataSource.getRepository(DimensionBudget).save(dataset.dimensionBudgets, { chunk: 50 });
  await dataSource.getRepository(Contract).save(dataset.contracts, { chunk: 25 });
  await dataSource.getRepository(PurchaseOrder).save(dataset.purchaseOrders, { chunk: 50 });

  console.log(
    `Generando ${SYNTHETIC_SUPPLIER_COUNT} proveedores x ${SYNTHETIC_INVOICES_PER_SUPPLIER} facturas...`,
  );

  let processed = 0;
  for (const group of dataset.invoicesBySupplier) {
    for (let index = 0; index < group.invoices.length; index += 20) {
      const batch = group.invoices.slice(index, index + 20);
      const prepared = [];
      for (const dto of batch) {
        prepared.push(await invoicesService.prepare(dto));
      }
      await invoicesService.saveMany(prepared);
      processed += prepared.length;
    }
    console.log(`${group.supplierId}: ${processed} facturas generadas en total`);
  }
}

seed().catch((error) => {
  console.error('Seed fallido', error);
  process.exit(1);
});
