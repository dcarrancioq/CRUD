import { Injectable } from '@angular/core';
import {
  Contract,
  PurchaseOrder,
  SpendCategory,
  Supplier,
  ToleranceProfile
} from '../models/invoice.model';

@Injectable({
  providedIn: 'root'
})
export class ProcurementMasterDataService {
  private readonly categories: SpendCategory[] = [
    {
      code: 'IT-CLOUD',
      name: 'Cloud e infraestructura',
      level: 2,
      parentCode: 'IT',
      glAccount: '628100',
      keywords: ['cloud', 'aws', 'azure', 'gcp', 'iaas', 'kubernetes', 'hosting', 'almacenamiento', 'computo']
    },
    {
      code: 'IT-SAAS',
      name: 'Licencias y suscripciones SaaS',
      level: 2,
      parentCode: 'IT',
      glAccount: '628200',
      keywords: ['licencia', 'licencias', 'suscripcion', 'saas', 'subscription', 'usuario/mes', 'office', 'jira', 'crm']
    },
    {
      code: 'IT-SOFT-MAINT',
      name: 'Mantenimiento y soporte software',
      level: 2,
      parentCode: 'IT',
      glAccount: '628300',
      keywords: ['mantenimiento', 'soporte', 'support', 'sla', 'renovacion soporte', 'garantia software']
    },
    {
      code: 'IT-HARDWARE',
      name: 'Hardware y equipamiento',
      level: 2,
      parentCode: 'IT',
      glAccount: '217000',
      keywords: ['portatil', 'laptop', 'servidor', 'monitor', 'switch', 'router', 'hardware', 'equipo']
    },
    {
      code: 'IT-TELCO',
      name: 'Telecomunicaciones y conectividad',
      level: 2,
      parentCode: 'IT',
      glAccount: '629100',
      keywords: ['telefonia', 'movil', 'fibra', 'mpls', 'internet', 'lineas', 'datos moviles', 'telco']
    },
    {
      code: 'IT-SERVICES',
      name: 'Servicios profesionales IT',
      level: 2,
      parentCode: 'IT',
      glAccount: '623000',
      keywords: ['consultoria', 'desarrollo', 'implantacion', 'horas', 'jornada', 'proyecto', 'staffing', 'bolsa de horas']
    },
    {
      code: 'IT-SECURITY',
      name: 'Ciberseguridad',
      level: 2,
      parentCode: 'IT',
      glAccount: '628400',
      keywords: ['seguridad', 'pentest', 'siem', 'antivirus', 'edr', 'auditoria seguridad', 'vulnerabilidades']
    },
    {
      code: 'GEN-FACILITIES',
      name: 'Servicios generales e instalaciones',
      level: 2,
      parentCode: 'GEN',
      glAccount: '621000',
      keywords: ['limpieza', 'suministro electrico', 'agua', 'alquiler', 'oficina', 'mantenimiento edificio']
    },
    {
      code: 'GEN-MARKETING',
      name: 'Marketing y publicidad',
      level: 2,
      parentCode: 'GEN',
      glAccount: '627000',
      keywords: ['campana', 'publicidad', 'marketing', 'eventos', 'branding', 'medios']
    },
    {
      code: 'GEN-OTHER',
      name: 'Otros gastos no clasificados',
      level: 2,
      parentCode: 'GEN',
      glAccount: '629900',
      keywords: []
    }
  ];

  private readonly suppliers: Supplier[] = [
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
          verificationChannel: 'callback'
        }
      ]
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
          verificationChannel: 'certificate'
        },
        {
          id: 'acc-003',
          supplierId: 'sup-002',
          iban: 'LT601010012345678901',
          holderName: 'Delta Soft Ltd',
          status: 'pending_verification',
          isPrimary: false,
          registeredAt: new Date('2026-07-20'),
          verificationChannel: 'none'
        }
      ]
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
          verificationChannel: 'portal'
        }
      ]
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
          verificationChannel: 'callback'
        }
      ]
    }
  ];

  private readonly contracts: Contract[] = [
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
      priceList: [
        { itemCode: 'CLOUD-VM-M', description: 'Instancia computo mediana', unitPrice: 120, uom: 'unidad/mes' },
        { itemCode: 'CLOUD-STG-TB', description: 'Almacenamiento objeto', unitPrice: 18, uom: 'TB/mes' }
      ]
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
      priceList: [
        { itemCode: 'LIC-CRM-USR', description: 'Licencia CRM por usuario', unitPrice: 45, uom: 'usuario/mes' }
      ]
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
      priceList: [
        { itemCode: 'SRV-DEV-SR', description: 'Jornada desarrollador senior', unitPrice: 520, uom: 'jornada' }
      ]
    }
  ];

  private readonly purchaseOrders: PurchaseOrder[] = [
    {
      id: 'po-001',
      number: 'PO-2026-0453',
      supplierId: 'sup-001',
      contractId: 'ctr-001',
      currency: 'EUR',
      issuedAt: new Date('2026-06-01'),
      costCenter: 'CC-IT-INFRA',
      approvedAmount: 40000,
      status: 'partially_received',
      lines: [
        {
          id: 'pol-001',
          lineNumber: 1,
          itemCode: 'CLOUD-VM-M',
          description: 'Instancia computo mediana',
          quantity: 200,
          uom: 'unidad/mes',
          unitPrice: 120,
          categoryCode: 'IT-CLOUD',
          receivedQuantity: 200,
          invoicedQuantity: 100
        },
        {
          id: 'pol-002',
          lineNumber: 2,
          itemCode: 'CLOUD-STG-TB',
          description: 'Almacenamiento objeto',
          quantity: 500,
          uom: 'TB/mes',
          unitPrice: 18,
          categoryCode: 'IT-CLOUD',
          receivedQuantity: 500,
          invoicedQuantity: 250
        }
      ]
    },
    {
      id: 'po-002',
      number: 'PO-2026-0511',
      supplierId: 'sup-002',
      contractId: 'ctr-002',
      currency: 'EUR',
      issuedAt: new Date('2026-06-20'),
      costCenter: 'CC-IT-APPS',
      approvedAmount: 27000,
      status: 'open',
      lines: [
        {
          id: 'pol-003',
          lineNumber: 1,
          itemCode: 'LIC-CRM-USR',
          description: 'Licencia CRM por usuario',
          quantity: 600,
          uom: 'usuario/mes',
          unitPrice: 45,
          categoryCode: 'IT-SAAS',
          receivedQuantity: 600,
          invoicedQuantity: 0
        }
      ]
    },
    {
      id: 'po-003',
      number: 'PO-2026-0602',
      supplierId: 'sup-003',
      contractId: 'ctr-003',
      currency: 'EUR',
      issuedAt: new Date('2026-07-01'),
      costCenter: 'CC-IT-APPS',
      approvedAmount: 52000,
      status: 'open',
      lines: [
        {
          id: 'pol-004',
          lineNumber: 1,
          itemCode: 'SRV-DEV-SR',
          description: 'Jornada desarrollador senior',
          quantity: 100,
          uom: 'jornada',
          unitPrice: 520,
          categoryCode: 'IT-SERVICES',
          receivedQuantity: 60,
          invoicedQuantity: 0
        }
      ]
    }
  ];

  private readonly toleranceProfile: ToleranceProfile = {
    id: 'tol-default',
    name: 'Perfil de tolerancias compras IT',
    currency: 'EUR',
    approvalThreshold: 15000,
    updatedAt: new Date('2026-07-01'),
    rules: [
      { ruleCode: 'DUPLICATE_EXACT', enabled: true, threshold: 0, unit: 'count', severity: 'critical', blocksPayment: true },
      { ruleCode: 'DUPLICATE_FUZZY', enabled: true, threshold: 70, unit: 'percent', severity: 'high', blocksPayment: true },
      { ruleCode: 'BANK_ACCOUNT_UNKNOWN', enabled: true, threshold: 0, unit: 'count', severity: 'critical', blocksPayment: true },
      { ruleCode: 'BANK_ACCOUNT_RECENT_CHANGE', enabled: true, threshold: 30, unit: 'days', severity: 'high', blocksPayment: true },
      { ruleCode: 'PRICE_DEVIATION_CONTRACT', enabled: true, threshold: 5, unit: 'percent', severity: 'medium', blocksPayment: false },
      { ruleCode: 'PO_AMOUNT_VARIANCE', enabled: true, threshold: 2, unit: 'percent', severity: 'medium', blocksPayment: false },
      { ruleCode: 'PO_MISSING', enabled: true, threshold: 3000, unit: 'amount', severity: 'medium', blocksPayment: false },
      { ruleCode: 'TOTALS_MISMATCH', enabled: true, threshold: 1, unit: 'amount', severity: 'high', blocksPayment: true },
      { ruleCode: 'TAX_MISMATCH', enabled: true, threshold: 1, unit: 'amount', severity: 'medium', blocksPayment: false },
      { ruleCode: 'THRESHOLD_SPLITTING', enabled: true, threshold: 5, unit: 'percent', severity: 'high', blocksPayment: false },
      { ruleCode: 'ROUND_AMOUNT', enabled: true, threshold: 10000, unit: 'amount', severity: 'low', blocksPayment: false },
      { ruleCode: 'AMOUNT_OUTLIER_HISTORY', enabled: true, threshold: 50, unit: 'percent', severity: 'medium', blocksPayment: false },
      { ruleCode: 'NEW_SUPPLIER_HIGH_AMOUNT', enabled: true, threshold: 10000, unit: 'amount', severity: 'high', blocksPayment: true },
      { ruleCode: 'PAYMENT_TERMS_MISMATCH', enabled: true, threshold: 5, unit: 'days', severity: 'low', blocksPayment: false },
      { ruleCode: 'CURRENCY_MISMATCH', enabled: true, threshold: 0, unit: 'count', severity: 'medium', blocksPayment: false },
      { ruleCode: 'BACKDATED_INVOICE', enabled: true, threshold: 90, unit: 'days', severity: 'low', blocksPayment: false },
      { ruleCode: 'LOW_CLASSIFICATION_CONFIDENCE', enabled: true, threshold: 60, unit: 'percent', severity: 'low', blocksPayment: false }
    ]
  };

  getCategories(): SpendCategory[] {
    return this.categories;
  }

  getCategory(code: string): SpendCategory | undefined {
    return this.categories.find(category => category.code === code);
  }

  getSuppliers(): Supplier[] {
    return this.suppliers;
  }

  getSupplier(id: string): Supplier | undefined {
    return this.suppliers.find(supplier => supplier.id === id);
  }

  getContracts(): Contract[] {
    return this.contracts;
  }

  getContractsBySupplier(supplierId: string): Contract[] {
    return this.contracts.filter(contract => contract.supplierId === supplierId);
  }

  getPurchaseOrders(): PurchaseOrder[] {
    return this.purchaseOrders;
  }

  getPurchaseOrderByNumber(number: string): PurchaseOrder | undefined {
    return this.purchaseOrders.find(order => order.number === number);
  }

  getToleranceProfile(): ToleranceProfile {
    return this.toleranceProfile;
  }
}
