import { DeepPartial } from 'typeorm';
import {
  CostCenterRef,
  companyCodes,
  costCenterSuffixForCategory,
  resolveCostCenter,
} from './organization-data';
import { BankAccountChange } from './modules/master-data/entities/bank-account-change.entity';
import { Contract } from './modules/master-data/entities/contract.entity';
import { DimensionBudget } from './modules/master-data/entities/dimension-budget.entity';
import { Supplier } from './modules/master-data/entities/supplier.entity';
import { SupplierBudget } from './modules/master-data/entities/supplier-budget.entity';
import { PurchaseOrder } from './modules/master-data/entities/purchase-order.entity';
import { CreateInvoiceDto } from './modules/invoices/dto/create-invoice.dto';
import { maskIban } from './modules/invoices/invoice.utils';

export const SYNTHETIC_SUPPLIER_COUNT = 50;
export const SYNTHETIC_INVOICES_PER_SUPPLIER = 100;
export const SYNTHETIC_YEARS = [2024, 2025, 2026];

/** Generador determinista: el mismo seed produce siempre el mismo dataset. */
function createRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface CategoryProfile {
  categoryCode: string;
  namePrefixes: string[];
  nameSuffix: string;
  costCenter: string;
  items: { itemCode: string; description: string; uom: string; unitPrice: number; quantity: number }[];
}

const CATEGORY_PROFILES: CategoryProfile[] = [
  {
    categoryCode: 'IT-CLOUD',
    namePrefixes: ['Nubia', 'Skyline', 'Datacore', 'Stratus', 'Cirrus', 'Altocumulus'],
    nameSuffix: 'Cloud Services S.L.',
    costCenter: 'CC-IT-INFRA',
    items: [
      { itemCode: 'CLOUD-VM-M', description: 'Instancia computo mediana', uom: 'unidad/mes', unitPrice: 118, quantity: 80 },
      { itemCode: 'CLOUD-STG-TB', description: 'Almacenamiento objeto', uom: 'TB/mes', unitPrice: 17, quantity: 180 },
      { itemCode: 'CLOUD-BKP', description: 'Backup gestionado', uom: 'TB/mes', unitPrice: 24, quantity: 60 },
    ],
  },
  {
    categoryCode: 'IT-SAAS',
    namePrefixes: ['Appsphere', 'Softlink', 'Nexolic', 'Prisma', 'Vertex', 'Quantia'],
    nameSuffix: 'Software S.A.',
    costCenter: 'CC-IT-APPS',
    items: [
      { itemCode: 'LIC-CRM-USR', description: 'Licencia CRM por usuario', uom: 'usuario/mes', unitPrice: 48, quantity: 220 },
      { itemCode: 'LIC-ITSM', description: 'Suscripcion ITSM', uom: 'agente/mes', unitPrice: 62, quantity: 90 },
      { itemCode: 'LIC-BI', description: 'Licencia analitica BI', uom: 'usuario/mes', unitPrice: 35, quantity: 140 },
    ],
  },
  {
    categoryCode: 'IT-SERVICES',
    namePrefixes: ['Orion', 'Meridian', 'Talentia', 'Solventis', 'Aurea', 'Kentia'],
    nameSuffix: 'Consulting S.L.',
    costCenter: 'CC-IT-APPS',
    items: [
      { itemCode: 'SRV-DEV-SR', description: 'Jornada desarrollador senior', uom: 'jornada', unitPrice: 520, quantity: 18 },
      { itemCode: 'SRV-ARQ', description: 'Jornada arquitecto de soluciones', uom: 'jornada', unitPrice: 690, quantity: 8 },
      { itemCode: 'SRV-QA', description: 'Jornada QA automatizacion', uom: 'jornada', unitPrice: 410, quantity: 15 },
    ],
  },
  {
    categoryCode: 'IT-HARDWARE',
    namePrefixes: ['Iberotec', 'Hardnova', 'Equipia', 'Servitek', 'Nortelec'],
    nameSuffix: 'Equipamiento S.L.',
    costCenter: 'CC-IT-WORKPLACE',
    items: [
      { itemCode: 'HW-LAPTOP', description: 'Portatil corporativo 14 pulgadas', uom: 'unidad', unitPrice: 1180, quantity: 12 },
      { itemCode: 'HW-MON', description: 'Monitor 27 pulgadas', uom: 'unidad', unitPrice: 265, quantity: 20 },
      { itemCode: 'HW-SW-SWITCH', description: 'Switch acceso 48 puertos', uom: 'unidad', unitPrice: 2100, quantity: 3 },
    ],
  },
  {
    categoryCode: 'IT-TELCO',
    namePrefixes: ['Telered', 'Fibranet', 'Comunika', 'Ondamovil', 'Redlink'],
    nameSuffix: 'Comunicaciones S.L.',
    costCenter: 'CC-IT-INFRA',
    items: [
      { itemCode: 'TEL-MOV', description: 'Lineas moviles datos corporativos', uom: 'linea/mes', unitPrice: 28, quantity: 320 },
      { itemCode: 'TEL-FIBRA', description: 'Fibra dedicada sede', uom: 'mes', unitPrice: 2450, quantity: 1 },
      { itemCode: 'TEL-MPLS', description: 'Enlace MPLS delegacion', uom: 'mes', unitPrice: 890, quantity: 4 },
    ],
  },
  {
    categoryCode: 'IT-SECURITY',
    namePrefixes: ['Cyberia', 'Secforge', 'Blindaje', 'Zerotrust', 'Guardia'],
    nameSuffix: 'Security S.L.',
    costCenter: 'CC-IT-SEC',
    items: [
      { itemCode: 'SEC-EDR', description: 'Licencia EDR endpoint', uom: 'endpoint/mes', unitPrice: 6, quantity: 1800 },
      { itemCode: 'SEC-SIEM', description: 'Servicio SIEM gestionado', uom: 'mes', unitPrice: 5400, quantity: 1 },
      { itemCode: 'SEC-PENTEST', description: 'Pentest aplicacion critica', uom: 'servicio', unitPrice: 8600, quantity: 1 },
    ],
  },
  {
    categoryCode: 'IT-SOFT-MAINT',
    namePrefixes: ['Mantia', 'Soportec', 'Sinergia', 'Sostenia', 'Duratec'],
    nameSuffix: 'Mantenimiento S.L.',
    costCenter: 'CC-IT-APPS',
    items: [
      { itemCode: 'MNT-ERP', description: 'Mantenimiento ERP soporte 24x7', uom: 'mes', unitPrice: 7200, quantity: 1 },
      { itemCode: 'MNT-DB', description: 'Soporte plataforma de datos', uom: 'mes', unitPrice: 3100, quantity: 1 },
      { itemCode: 'MNT-SLA', description: 'Ampliacion SLA garantia software', uom: 'mes', unitPrice: 1450, quantity: 2 },
    ],
  },
  {
    categoryCode: 'GEN-MARKETING',
    namePrefixes: ['Creativa', 'Mediabrand', 'Impacta', 'Publigrafo', 'Eventia'],
    nameSuffix: 'Marketing S.L.',
    costCenter: 'CC-MKT',
    items: [
      { itemCode: 'MKT-CAMP', description: 'Campaña digital multicanal', uom: 'servicio', unitPrice: 9800, quantity: 1 },
      { itemCode: 'MKT-EVENT', description: 'Organizacion de evento corporativo', uom: 'servicio', unitPrice: 14500, quantity: 1 },
      { itemCode: 'MKT-MEDIA', description: 'Compra de medios', uom: 'insercion', unitPrice: 1250, quantity: 6 },
    ],
  },
  {
    categoryCode: 'GEN-FACILITIES',
    namePrefixes: ['Limpiara', 'Facilita', 'Instalia', 'Oficinova', 'Serviedificio'],
    nameSuffix: 'Servicios Generales S.L.',
    costCenter: 'CC-FAC',
    items: [
      { itemCode: 'FAC-LIMP', description: 'Servicio de limpieza mensual', uom: 'mes', unitPrice: 4300, quantity: 1 },
      { itemCode: 'FAC-MANT', description: 'Mantenimiento instalaciones', uom: 'mes', unitPrice: 2600, quantity: 1 },
      { itemCode: 'FAC-SUM', description: 'Suministro material oficina', uom: 'lote', unitPrice: 780, quantity: 3 },
    ],
  },
];

const IBAN_BANK_CODES = ['2100', '0049', '0075', '0182', '2077', '1465', '0081'];
const SOURCES: CreateInvoiceDto['source'][] = ['edi', 'email', 'supplier_portal', 'ocr', 'manual'];

export interface SyntheticDataset {
  suppliers: DeepPartial<Supplier>[];
  bankAccountChanges: DeepPartial<BankAccountChange>[];
  budgets: DeepPartial<SupplierBudget>[];
  /** Presupuesto analitico al grano sociedad + area + categoria. */
  dimensionBudgets: DeepPartial<DimensionBudget>[];
  contracts: DeepPartial<Contract>[];
  purchaseOrders: DeepPartial<PurchaseOrder>[];
  /** Facturas agrupadas por proveedor: permite persistir por lotes. */
  invoicesBySupplier: { supplierId: string; invoices: CreateInvoiceDto[] }[];
}

function pad(value: number, length: number): string {
  return String(value).padStart(length, '0');
}

function buildIban(random: () => number, index: number): string {
  const bank = IBAN_BANK_CODES[index % IBAN_BANK_CODES.length];
  const rest = `${pad(Math.floor(random() * 9999), 4)}${pad(Math.floor(random() * 99), 2)}${pad(
    Math.floor(random() * 9999999999),
    10,
  )}`;
  return `ES${pad(10 + (index % 89), 2)}${bank}${rest}`.slice(0, 24);
}

function isoDate(year: number, month: number, day: number): string {
  return `${year}-${pad(month, 2)}-${pad(day, 2)}`;
}

function addDays(date: string, days: number): string {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result.toISOString().slice(0, 10);
}

/**
 * Dataset sintetico de compras: 50 proveedores repartidos por categoria, presupuesto
 * anual por ejercicio y 100 facturas por proveedor con una proporcion controlada de
 * anomalias (duplicados, gasto sin pedido, descuadres e importes atipicos) para que
 * el motor de excepciones y el informe de proveedor tengan casos reales que mostrar.
 */
export function buildSyntheticDataset(existingSupplierCount = 0): SyntheticDataset {
  const random = createRandom(20260805);
  const suppliers: DeepPartial<Supplier>[] = [];
  const bankAccountChanges: DeepPartial<BankAccountChange>[] = [];
  const budgets: DeepPartial<SupplierBudget>[] = [];
  const contracts: DeepPartial<Contract>[] = [];
  const purchaseOrders: DeepPartial<PurchaseOrder>[] = [];
  const invoicesBySupplier: { supplierId: string; invoices: CreateInvoiceDto[] }[] = [];
  /** Consumo imputado por ejercicio + sociedad + area + categoria, base del presupuesto. */
  const consumptionByDimension = new Map<string, number>();

  for (let index = 0; index < SYNTHETIC_SUPPLIER_COUNT; index += 1) {
    const profile = CATEGORY_PROFILES[index % CATEGORY_PROFILES.length];
    const prefix = profile.namePrefixes[Math.floor(index / CATEGORY_PROFILES.length) % profile.namePrefixes.length];
    const sequence = existingSupplierCount + index + 1;
    const supplierId = `sup-${pad(sequence, 3)}`;
    const legalName = `${prefix} ${pad(index + 1, 2)} ${profile.nameSuffix}`;
    const taxId = `${index % 2 === 0 ? 'B' : 'A'}${pad(10000000 + index * 7919, 8)}`;
    const paymentTermsDays = [30, 45, 60][index % 3];
    const onboardedYear = 2017 + (index % 9);
    const onboardedAt = isoDate(onboardedYear, 1 + (index % 12), 1 + (index % 27));
    const primaryIban = buildIban(random, index);
    const hasBankChange = index % 7 === 0;
    const secondaryIban = buildIban(random, index + 101);

    suppliers.push({
      id: supplierId,
      taxId,
      legalName,
      tradeName: `${prefix} ${pad(index + 1, 2)}`,
      country: 'ES',
      status: index % 23 === 0 ? 'pending_validation' : 'active',
      defaultCategoryCode: profile.categoryCode,
      paymentTermsDays,
      onboardedAt: new Date(onboardedAt),
      riskScore: Math.floor(random() * 45),
      contactEmail: `facturacion@${prefix.toLowerCase()}${pad(index + 1, 2)}.example`,
      bankAccounts: [
        {
          id: `acc-${supplierId}-1`,
          supplierId,
          iban: primaryIban,
          holderName: legalName,
          status: 'verified',
          isPrimary: true,
          registeredAt: new Date(onboardedAt),
          verifiedAt: new Date(addDays(onboardedAt, 6)),
          verifiedBy: 'compras.masterdata',
          verificationChannel: 'callback',
        },
        ...(hasBankChange
          ? [
              {
                id: `acc-${supplierId}-2`,
                supplierId,
                iban: secondaryIban,
                holderName: index % 14 === 0 ? `${prefix} Global Ltd` : legalName,
                status: 'pending_verification' as const,
                isPrimary: false,
                registeredAt: new Date('2026-06-18'),
                verificationChannel: 'none' as const,
              },
            ]
          : []),
      ],
    });

    if (hasBankChange) {
      bankAccountChanges.push({
        id: `bac-${supplierId}`,
        supplierId,
        previousAccountId: `acc-${supplierId}-1`,
        newAccountId: `acc-${supplierId}-2`,
        previousIbanMasked: maskIban(primaryIban),
        newIbanMasked: maskIban(secondaryIban),
        changedAt: new Date('2026-06-18'),
        changedBy: 'proveedor.portal',
        requestChannel: 'email',
        verified: false,
      });
    }

    /**
     * Cada proveedor factura principalmente a una sociedad y ademas a una segunda,
     * de modo que existen proveedores y contratos compartidos entre sociedades.
     */
    const primaryCompany = companyCodes[index % companyCodes.length];
    const secondaryCompany = companyCodes[(index + 1 + (index % 2)) % companyCodes.length];
    const supplierData = buildSupplierInvoices({
      random,
      supplierId,
      supplierIndex: index,
      legalName,
      profile,
      paymentTermsDays,
      primaryIban,
      secondaryIban,
      hasBankChange,
      primaryCompany,
      secondaryCompany,
    });
    const invoices = supplierData.invoices;
    purchaseOrders.push(...supplierData.purchaseOrders);
    supplierData.consumption.forEach((amount, key) => {
      consumptionByDimension.set(key, (consumptionByDimension.get(key) ?? 0) + amount);
    });
    contracts.push(
      ...buildSupplierContracts({
        random,
        supplierId,
        supplierIndex: index,
        legalName,
        profile,
        paymentTermsDays,
        primaryCompany,
        secondaryCompany,
        annualSpend: supplierData.consumption.size
          ? [...supplierData.consumption.values()].reduce((total, value) => total + value, 0) /
            SYNTHETIC_YEARS.length
          : 60000,
      }),
    );

    /**
     * El presupuesto se calibra sobre el gasto realmente generado en cada ejercicio
     * (entre el 80% y el 125%), de modo que hay proveedores holgados, en aviso y pasados.
     */
    SYNTHETIC_YEARS.forEach((year) => {
      const yearSpend = invoices
        .filter((invoice) => invoice.issueDate.startsWith(String(year)))
        .reduce((total, invoice) => total + estimateInvoiceTotal(invoice), 0);
      const annualized = year === 2026 ? (yearSpend / 8) * 12 : yearSpend;
      const budgetFactor = 0.8 + random() * 0.45;
      budgets.push({
        id: `bud-${supplierId}-${year}`,
        supplierId,
        fiscalYear: year,
        budgetAmount: Math.max(10000, Math.round((annualized * budgetFactor) / 1000) * 1000),
        currency: 'EUR',
        categoryCode: profile.categoryCode,
        alertThresholdPercent: [80, 85, 90][index % 3],
        ownerEmail: `categoria.${profile.categoryCode.toLowerCase()}@empresa.example`,
        notes: `Presupuesto ${year} aprobado para ${profile.categoryCode}`,
      });
    });

    invoicesBySupplier.push({ supplierId, invoices });
  }

  /**
   * El presupuesto por dimension se calibra sobre el consumo real imputado a cada
   * sociedad/area/categoria (85%-118%), de forma que el cuadro de mando muestre
   * dimensiones holgadas, en aviso y con desviacion.
   */
  const dimensionBudgets: DeepPartial<DimensionBudget>[] = [...consumptionByDimension.entries()].map(
    ([key, amount], position) => {
      const [fiscalYear, companyId, orgUnitId, categoryCode] = key.split('|');
      const annualized = fiscalYear === '2026' ? (amount / 8) * 12 : amount;
      const factor = 0.85 + random() * 0.33;
      return {
        id: `dbud-${fiscalYear}-${companyId}-${orgUnitId}-${categoryCode}`.toLowerCase(),
        fiscalYear: Number(fiscalYear),
        companyId,
        orgUnitId,
        categoryCode,
        budgetAmount: Math.max(5000, Math.round((annualized * factor) / 500) * 500),
        currency: 'EUR',
        alertThresholdPercent: [80, 85, 90][position % 3],
        ownerEmail: `presupuesto.${categoryCode.toLowerCase()}@empresa.example`,
      };
    },
  );

  return {
    suppliers,
    bankAccountChanges,
    budgets,
    dimensionBudgets,
    contracts,
    purchaseOrders,
    invoicesBySupplier,
  };
}

/**
 * Contratos del proveedor (1 a 3), cada uno con su ambito de consumo: una o varias
 * sociedades y, opcionalmente, un area concreta. Un ambito sin area habilita el
 * contrato para toda la sociedad.
 */
function buildSupplierContracts(input: {
  random: () => number;
  supplierId: string;
  supplierIndex: number;
  legalName: string;
  profile: CategoryProfile;
  paymentTermsDays: number;
  primaryCompany: string;
  secondaryCompany: string;
  annualSpend: number;
}): DeepPartial<Contract>[] {
  const {
    random,
    supplierId,
    supplierIndex,
    profile,
    paymentTermsDays,
    primaryCompany,
    secondaryCompany,
    annualSpend,
  } = input;

  const suffix = costCenterSuffixForCategory(profile.categoryCode);
  const contractCount = 1 + (supplierIndex % 3);
  const contracts: DeepPartial<Contract>[] = [];

  for (let position = 0; position < contractCount; position += 1) {
    const startYear = SYNTHETIC_YEARS[position % SYNTHETIC_YEARS.length];
    const expired = startYear < 2026;
    const contractId = `ctr-${supplierId}-${position + 1}`;
    const primaryRef = resolveCostCenter(primaryCompany, suffix);
    const secondaryRef = resolveCostCenter(secondaryCompany, suffix);
    /** Contrato marco de grupo: alcanza a la sociedad completa, sin area concreta. */
    const groupWide = position === 1;

    contracts.push({
      id: contractId,
      supplierId,
      reference: `CTR-${supplierId.toUpperCase()}-${startYear}-${position + 1}`,
      description: `Contrato ${profile.categoryCode} ${startYear} (${
        groupWide ? 'marco de grupo' : 'ambito por area'
      })`,
      categoryCode: profile.categoryCode,
      validFrom: new Date(isoDate(startYear, 1, 1)),
      validUntil: new Date(isoDate(startYear, 12, 31)),
      committedAnnualSpend: Math.max(20000, Math.round((annualSpend * (0.6 + random() * 0.7)) / 1000) * 1000),
      currency: 'EUR',
      paymentTermsDays,
      earlyPaymentDiscountPercent: random() < 0.4 ? Math.round(random() * 20) / 10 : undefined,
      autoRenew: random() < 0.5,
      status: expired ? 'expired' : 'active',
      scopes: groupWide
        ? [
            { id: `cts-${contractId}-1`, contractId, companyId: primaryRef.companyId },
            { id: `cts-${contractId}-2`, contractId, companyId: secondaryRef.companyId },
          ]
        : [
            {
              id: `cts-${contractId}-1`,
              contractId,
              companyId: primaryRef.companyId,
              orgUnitId: primaryRef.orgUnitId,
            },
            ...(primaryRef.companyId === secondaryRef.companyId
              ? []
              : [
                  {
                    id: `cts-${contractId}-2`,
                    contractId,
                    companyId: secondaryRef.companyId,
                    orgUnitId: secondaryRef.orgUnitId,
                  },
                ]),
          ],
      priceList: profile.items.slice(0, 2).map((item, itemIndex) => ({
        id: `ctp-${contractId}-${itemIndex + 1}`,
        contractId,
        itemCode: item.itemCode,
        description: item.description,
        unitPrice: item.unitPrice,
        uom: item.uom,
      })),
    });
  }

  return contracts;
}

function buildSupplierInvoices(input: {
  random: () => number;
  supplierId: string;
  supplierIndex: number;
  legalName: string;
  profile: CategoryProfile;
  paymentTermsDays: number;
  primaryIban: string;
  secondaryIban: string;
  hasBankChange: boolean;
  primaryCompany: string;
  secondaryCompany: string;
}): {
  invoices: CreateInvoiceDto[];
  purchaseOrders: DeepPartial<PurchaseOrder>[];
  consumption: Map<string, number>;
} {
  const {
    random,
    supplierId,
    supplierIndex,
    legalName,
    profile,
    paymentTermsDays,
    primaryIban,
    secondaryIban,
    hasBankChange,
    primaryCompany,
    secondaryCompany,
  } = input;

  const invoices: CreateInvoiceDto[] = [];
  /** Reenvios del proveedor: se anaden al final para que el original ya este registrado. */
  const reissues: CreateInvoiceDto[] = [];
  const consumption = new Map<string, number>();
  const purchaseOrders: DeepPartial<PurchaseOrder>[] = [];
  const perYear = Math.floor(SYNTHETIC_INVOICES_PER_SUPPLIER / SYNTHETIC_YEARS.length);
  const documentPrefix = legalName.slice(0, 3).toUpperCase();
  let sequence = 1;

  const suffix = costCenterSuffixForCategory(profile.categoryCode);
  /** CECOs candidatos del reparto: el afin a la categoria y alternativos de otra sociedad/area. */
  const targets: CostCenterRef[] = dedupeRefs([
    resolveCostCenter(primaryCompany, suffix),
    resolveCostCenter(secondaryCompany, suffix),
    resolveCostCenter(primaryCompany, 'OPS'),
  ]);

  SYNTHETIC_YEARS.forEach((year, yearIndex) => {
    const count = yearIndex === SYNTHETIC_YEARS.length - 1
      ? SYNTHETIC_INVOICES_PER_SUPPLIER - perYear * (SYNTHETIC_YEARS.length - 1)
      : perYear;
    const maxMonth = year === 2026 ? 8 : 12;

    for (let position = 0; position < count; position += 1) {
      const month = 1 + Math.floor((position / count) * maxMonth);
      const day = 1 + Math.floor(random() * 27);
      const issueDate = isoDate(year, Math.min(month, maxMonth), day);
      const receivedDate = addDays(issueDate, 1 + Math.floor(random() * 6));
      const dueDate = addDays(issueDate, paymentTermsDays);
      const item = profile.items[position % profile.items.length];
      const volumeFactor = 0.7 + random() * 0.7;
      const quantity = Math.max(1, Math.round(item.quantity * volumeFactor));
      const priceDrift = 1 + (random() - 0.35) * 0.14;
      const unitPrice = Math.round(item.unitPrice * priceDrift * 100) / 100;
      const secondItem = profile.items[(position + 1) % profile.items.length];
      const withSecondLine = random() < 0.45;
      const withoutPo = random() < 0.12;
      /** Pedido aprobado por debajo de lo facturado: genera desviacion real sobre PO. */
      const poUnderApproved = random() < 0.09;
      const number = `${documentPrefix}-${year}-${pad(sequence, 4)}`;
      const purchaseOrderNumber = withoutPo
        ? undefined
        : `PO-${supplierId}-${year}-${pad(position + 1, 3)}`;
      sequence += 1;

      const lines: CreateInvoiceDto['lines'] = [
        {
          itemCode: item.itemCode,
          description: item.description,
          quantity,
          uom: item.uom,
          unitPrice,
          taxRate: 21,
        },
      ];

      if (withSecondLine) {
        lines.push({
          itemCode: secondItem.itemCode,
          description: secondItem.description,
          quantity: Math.max(1, Math.round(secondItem.quantity * (0.4 + random() * 0.5))),
          uom: secondItem.uom,
          unitPrice: Math.round(secondItem.unitPrice * (0.95 + random() * 0.12) * 100) / 100,
          taxRate: 21,
        });
      }

      const linesTotal = lines.reduce((total, line) => total + line.quantity * line.unitPrice, 0);
      const roundAmountCase = random() < 0.04;
      const totalsMismatchCase = random() < 0.05;
      const subtotal = roundAmountCase
        ? Math.max(10000, Math.round(linesTotal / 5000) * 5000)
        : undefined;

      const invoice: CreateInvoiceDto = {
        invoiceNumber: number,
        supplierId,
        purchaseOrderNumber,
        issueDate,
        receivedDate,
        dueDate,
        currency: random() < 0.03 ? 'USD' : 'EUR',
        exchangeRate: 1,
        taxRate: 21,
        paymentTermsDays: random() < 0.12 ? paymentTermsDays - 15 : paymentTermsDays,
        paymentMethod: 'transfer',
        bankAccountIban: hasBankChange && year === 2026 && random() < 0.15 ? secondaryIban : primaryIban,
        bankAccountHolder: legalName,
        costCenter: profile.costCenter,
        requesterEmail: `solicitante${1 + (supplierIndex % 9)}@empresa.example`,
        description: `${item.description} ${pad(Math.min(month, maxMonth), 2)}/${year}`,
        source: SOURCES[Math.floor(random() * SOURCES.length)],
        lines,
        declaredSubtotal: subtotal,
        declaredTotalAmount: totalsMismatchCase
          ? Math.round((linesTotal * 1.21 + 45 + random() * 300) * 100) / 100
          : undefined,
      };

      invoice.allocations = buildInvoiceAllocations(random, exactInvoiceTotal(invoice), targets);
      invoice.costCenter = invoice.allocations[0].costCenterCode;
      registerConsumption(consumption, year, invoice, profile.categoryCode, targets);

      invoices.push(invoice);

      if (purchaseOrderNumber) {
        purchaseOrders.push(
          buildPurchaseOrder({
            purchaseOrderNumber,
            supplierId,
            invoice,
            categoryCode: profile.categoryCode,
            linesTotal,
            underApproved: poUnderApproved,
            costCenter: targets[0],
            /** Un 22% de pedidos siguen abiertos: son el compromiso pendiente del cuadro de mando. */
            open: random() < 0.22,
            lateDelivery: random() < 0.18,
            random,
          }),
        );
      }

      /** Reenvio del proveedor: alimenta la deteccion exacta y difusa de duplicados. */
      if (random() < 0.03) {
        reissues.push({
          ...invoice,
          invoiceNumber: number.replace(/-/g, ' '),
          receivedDate: addDays(receivedDate, 9),
          source: 'email',
          description: `${invoice.description} (reenvio del proveedor)`,
        });
      }
    }
  });

  const trimmed = [...invoices, ...reissues].slice(0, SYNTHETIC_INVOICES_PER_SUPPLIER);
  const keptNumbers = new Set(trimmed.map((invoice) => invoice.purchaseOrderNumber));
  const kept = purchaseOrders.filter((order) => keptNumbers.has(order.number as string));

  /**
   * Pedidos aprobados pendientes de facturar: son el compromiso vivo que resta
   * presupuesto disponible aunque todavia no haya llegado ninguna factura.
   */
  const commitmentCount = 1 + (supplierIndex % 3);
  for (let position = 0; position < commitmentCount; position += 1) {
    const target = targets[position % targets.length];
    const item = profile.items[position % profile.items.length];
    const quantity = Math.max(1, Math.round(item.quantity * (0.5 + random() * 0.8)));
    const number = `PO-${supplierId}-2026-C${position + 1}`;
    const issuedAt = isoDate(2026, 5 + (position % 4), 3 + Math.floor(random() * 20));

    kept.push({
      id: `po-${number.toLowerCase()}`,
      number,
      supplierId,
      currency: 'EUR',
      issuedAt: new Date(issuedAt),
      costCenter: target.code,
      companyId: target.companyId,
      orgUnitId: target.orgUnitId,
      categoryCode: profile.categoryCode,
      expectedDeliveryDate: new Date(addDays(issuedAt, 30)),
      approvedAmount: round2(quantity * item.unitPrice * 1.21),
      status: random() < 0.2 ? 'partially_received' : 'open',
      lines: [
        {
          id: `pol-${number.toLowerCase()}-1`,
          purchaseOrderId: `po-${number.toLowerCase()}`,
          lineNumber: 1,
          itemCode: item.itemCode,
          description: item.description,
          quantity,
          uom: item.uom,
          unitPrice: item.unitPrice,
          categoryCode: profile.categoryCode,
          receivedQuantity: 0,
          invoicedQuantity: 0,
        },
      ],
    });
  }

  return { invoices: trimmed, purchaseOrders: kept, consumption };
}

function dedupeRefs(refs: CostCenterRef[]): CostCenterRef[] {
  const seen = new Set<string>();
  return refs.filter((ref) => {
    if (seen.has(ref.code)) {
      return false;
    }
    seen.add(ref.code);
    return true;
  });
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Replica el calculo del total que hara el backend, para cuadrar repartos por importe. */
function exactInvoiceTotal(invoice: CreateInvoiceDto): number {
  const linesSum = round2(
    invoice.lines.reduce((total, line) => total + round2(line.quantity * line.unitPrice), 0),
  );
  const subtotal = invoice.declaredSubtotal ?? linesSum;
  const taxAmount = invoice.declaredTaxAmount ?? round2((subtotal * invoice.taxRate) / 100);
  return invoice.declaredTotalAmount ?? round2(subtotal + taxAmount);
}

/**
 * Reparto analitico: la mayoria de facturas van a un unico CECO y el resto se
 * reparten entre dos o tres, la mitad por porcentaje y la mitad por importe, para
 * cubrir los dos criterios admitidos.
 */
function buildInvoiceAllocations(
  random: () => number,
  totalAmount: number,
  targets: CostCenterRef[],
): NonNullable<CreateInvoiceDto['allocations']> {
  const draw = random();
  if (draw < 0.7 || targets.length < 2 || totalAmount <= 0) {
    return [{ costCenterCode: targets[0].code, mode: 'percent', value: 100 }];
  }

  const threeWay = targets.length > 2 && random() < 0.4;
  if (draw < 0.85) {
    return threeWay
      ? [
          { costCenterCode: targets[0].code, mode: 'percent', value: 50 },
          { costCenterCode: targets[1].code, mode: 'percent', value: 30 },
          { costCenterCode: targets[2].code, mode: 'percent', value: 20 },
        ]
      : [
          { costCenterCode: targets[0].code, mode: 'percent', value: 65 },
          { costCenterCode: targets[1].code, mode: 'percent', value: 35 },
        ];
  }

  const first = round2(totalAmount * (threeWay ? 0.5 : 0.6));
  if (!threeWay) {
    return [
      { costCenterCode: targets[0].code, mode: 'amount', value: first },
      { costCenterCode: targets[1].code, mode: 'amount', value: round2(totalAmount - first) },
    ];
  }
  const second = round2(totalAmount * 0.3);
  return [
    { costCenterCode: targets[0].code, mode: 'amount', value: first },
    { costCenterCode: targets[1].code, mode: 'amount', value: second },
    { costCenterCode: targets[2].code, mode: 'amount', value: round2(totalAmount - first - second) },
  ];
}

/** Acumula el importe imputado a cada sociedad/area/categoria del ejercicio. */
function registerConsumption(
  consumption: Map<string, number>,
  year: number,
  invoice: CreateInvoiceDto,
  categoryCode: string,
  targets: CostCenterRef[],
): void {
  const total = exactInvoiceTotal(invoice);
  (invoice.allocations ?? []).forEach((allocation) => {
    const ref = targets.find((candidate) => candidate.code === allocation.costCenterCode);
    if (!ref) {
      return;
    }
    const amount =
      allocation.mode === 'amount' ? allocation.value : round2((total * allocation.value) / 100);
    const key = `${year}|${ref.companyId}|${ref.orgUnitId}|${categoryCode}`;
    consumption.set(key, round2((consumption.get(key) ?? 0) + amount));
  });
}

/**
 * Pedido que respalda la factura: cubre lo facturado salvo en los casos preparados
 * para que la conciliacion detecte desviacion de importe y de precio sobre lo aprobado.
 */
function buildPurchaseOrder(input: {
  purchaseOrderNumber: string;
  supplierId: string;
  invoice: CreateInvoiceDto;
  categoryCode: string;
  linesTotal: number;
  underApproved: boolean;
  costCenter: CostCenterRef;
  open: boolean;
  lateDelivery: boolean;
  random: () => number;
}): DeepPartial<PurchaseOrder> {
  const {
    purchaseOrderNumber,
    supplierId,
    invoice,
    categoryCode,
    linesTotal,
    underApproved,
    costCenter,
    open,
    lateDelivery,
    random,
  } = input;
  const priceFactor = underApproved ? 0.86 : 1;
  const expectedDeliveryDate = addDays(invoice.issueDate, -2);
  const deliveredAt = open
    ? undefined
    : addDays(expectedDeliveryDate, lateDelivery ? 3 + Math.floor(random() * 12) : -Math.floor(random() * 4));

  return {
    id: `po-${purchaseOrderNumber.toLowerCase()}`,
    number: purchaseOrderNumber,
    supplierId,
    currency: invoice.currency,
    issuedAt: new Date(addDays(invoice.issueDate, -12)),
    costCenter: costCenter.code,
    companyId: costCenter.companyId,
    orgUnitId: costCenter.orgUnitId,
    categoryCode,
    expectedDeliveryDate: new Date(expectedDeliveryDate),
    deliveredAt: deliveredAt ? new Date(deliveredAt) : undefined,
    approvedAmount: Math.round(linesTotal * priceFactor * 100) / 100,
    status: open ? 'open' : 'closed',
    lines: invoice.lines.map((line, lineIndex) => ({
      id: `pol-${purchaseOrderNumber.toLowerCase()}-${lineIndex + 1}`,
      purchaseOrderId: `po-${purchaseOrderNumber.toLowerCase()}`,
      lineNumber: lineIndex + 1,
      itemCode: line.itemCode,
      description: line.description,
      quantity: line.quantity,
      uom: line.uom,
      unitPrice: Math.round(line.unitPrice * priceFactor * 100) / 100,
      categoryCode: line.categoryCode ?? categoryCode,
      receivedQuantity: line.quantity,
      invoicedQuantity: 0,
    })),
  };
}

/** Total aproximado de la factura para calibrar presupuestos antes de evaluarla. */
function estimateInvoiceTotal(invoice: CreateInvoiceDto): number {
  if (invoice.declaredTotalAmount) {
    return invoice.declaredTotalAmount;
  }
  const subtotal =
    invoice.declaredSubtotal ??
    invoice.lines.reduce((total, line) => total + line.quantity * line.unitPrice, 0);
  return subtotal * (1 + invoice.taxRate / 100);
}
