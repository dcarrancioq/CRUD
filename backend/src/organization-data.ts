import { DeepPartial } from 'typeorm';
import { Company } from './modules/master-data/entities/company.entity';
import { CostCenter } from './modules/master-data/entities/cost-center.entity';
import { OrgUnit } from './modules/master-data/entities/org-unit.entity';

interface CompanyDefinition {
  code: string;
  legalName: string;
  taxId: string;
  country: string;
  /** Sufijos de area presentes en la sociedad. */
  areas: string[];
}

interface AreaDefinition {
  suffix: string;
  name: string;
  type: 'area' | 'department';
  /** Sufijos de CECO que cuelgan del area. */
  costCenters: { suffix: string; name: string; glAccount: string }[];
}

const AREAS: AreaDefinition[] = [
  {
    suffix: 'TEC',
    name: 'Tecnologia y Sistemas',
    type: 'area',
    costCenters: [
      { suffix: 'IT-INFRA', name: 'Infraestructura y cloud', glAccount: '628100' },
      { suffix: 'IT-APPS', name: 'Aplicaciones corporativas', glAccount: '628200' },
      { suffix: 'IT-WORKPLACE', name: 'Puesto de trabajo', glAccount: '217000' },
    ],
  },
  {
    suffix: 'SEC',
    name: 'Seguridad de la Informacion',
    type: 'department',
    costCenters: [{ suffix: 'IT-SEC', name: 'Ciberseguridad', glAccount: '628400' }],
  },
  {
    suffix: 'OPS',
    name: 'Operaciones',
    type: 'area',
    costCenters: [{ suffix: 'OPS', name: 'Operaciones y servicio', glAccount: '623000' }],
  },
  {
    suffix: 'FIN',
    name: 'Finanzas y Administracion',
    type: 'area',
    costCenters: [{ suffix: 'FIN', name: 'Administracion y finanzas', glAccount: '629900' }],
  },
  {
    suffix: 'MKT',
    name: 'Marketing y Comercial',
    type: 'area',
    costCenters: [{ suffix: 'MKT', name: 'Marketing y comunicacion', glAccount: '627000' }],
  },
  {
    suffix: 'FAC',
    name: 'Servicios Generales',
    type: 'area',
    costCenters: [{ suffix: 'FAC', name: 'Instalaciones y servicios', glAccount: '621000' }],
  },
];

const COMPANY_DEFINITIONS: CompanyDefinition[] = [
  {
    code: 'ES01',
    legalName: 'Iberia Tech Solutions, S.A.',
    taxId: 'A11111111',
    country: 'ES',
    areas: ['TEC', 'SEC', 'OPS', 'FIN', 'MKT', 'FAC'],
  },
  {
    code: 'ES02',
    legalName: 'Iberia Servicios Corporativos, S.L.',
    taxId: 'B22222222',
    country: 'ES',
    areas: ['OPS', 'FIN', 'MKT', 'FAC'],
  },
  {
    code: 'ES03',
    legalName: 'Iberia Mobility Rental, S.A.',
    taxId: 'A33333333',
    country: 'ES',
    areas: ['TEC', 'OPS', 'MKT', 'FAC'],
  },
  {
    code: 'PT01',
    legalName: 'Atlantico Digital, Unipessoal Lda',
    taxId: 'PT500123456',
    country: 'PT',
    areas: ['TEC', 'SEC', 'OPS', 'FIN'],
  },
];

export interface CostCenterRef {
  code: string;
  companyId: string;
  companyCode: string;
  orgUnitId: string;
  areaSuffix: string;
}

export const companies: DeepPartial<Company>[] = COMPANY_DEFINITIONS.map((definition) => ({
  id: `co-${definition.code.toLowerCase()}`,
  code: definition.code,
  legalName: definition.legalName,
  taxId: definition.taxId,
  country: definition.country,
  currency: 'EUR',
  status: 'active',
}));

export const orgUnits: DeepPartial<OrgUnit>[] = COMPANY_DEFINITIONS.flatMap((definition) =>
  definition.areas.map((suffix) => {
    const area = AREAS.find((candidate) => candidate.suffix === suffix);
    if (!area) {
      throw new Error(`Area ${suffix} no definida`);
    }
    return {
      id: `ou-${definition.code.toLowerCase()}-${suffix.toLowerCase()}`,
      code: `AR-${suffix}`,
      name: area.name,
      companyId: `co-${definition.code.toLowerCase()}`,
      type: area.type,
      managerEmail: `resp.${suffix.toLowerCase()}@${definition.code.toLowerCase()}.example`,
      status: 'active',
    };
  }),
);

export const costCenters: DeepPartial<CostCenter>[] = COMPANY_DEFINITIONS.flatMap((definition) =>
  definition.areas.flatMap((areaSuffix) => {
    const area = AREAS.find((candidate) => candidate.suffix === areaSuffix);
    if (!area) {
      throw new Error(`Area ${areaSuffix} no definida`);
    }
    return area.costCenters.map((costCenter) => ({
      id: `cc-${definition.code.toLowerCase()}-${costCenter.suffix.toLowerCase()}`,
      code: `CC-${definition.code}-${costCenter.suffix}`,
      name: `${costCenter.name} (${definition.code})`,
      companyId: `co-${definition.code.toLowerCase()}`,
      orgUnitId: `ou-${definition.code.toLowerCase()}-${areaSuffix.toLowerCase()}`,
      glAccount: costCenter.glAccount,
      ownerEmail: `ceco.${costCenter.suffix.toLowerCase()}@${definition.code.toLowerCase()}.example`,
      status: 'active',
    }));
  }),
);

export const costCenterRefs: CostCenterRef[] = COMPANY_DEFINITIONS.flatMap((definition) =>
  definition.areas.flatMap((areaSuffix) => {
    const area = AREAS.find((candidate) => candidate.suffix === areaSuffix);
    if (!area) {
      throw new Error(`Area ${areaSuffix} no definida`);
    }
    return area.costCenters.map((costCenter) => ({
      code: `CC-${definition.code}-${costCenter.suffix}`,
      companyId: `co-${definition.code.toLowerCase()}`,
      companyCode: definition.code,
      orgUnitId: `ou-${definition.code.toLowerCase()}-${areaSuffix.toLowerCase()}`,
      areaSuffix,
    }));
  }),
);

export const companyCodes = COMPANY_DEFINITIONS.map((definition) => definition.code);

/**
 * CECO de la sociedad para un sufijo dado (por ejemplo `IT-INFRA`). Si la sociedad
 * no tiene ese centro, se cae al primero disponible para que toda factura acabe
 * imputada a una sociedad y area reales.
 */
export function resolveCostCenter(companyCode: string, suffix: string): CostCenterRef {
  const exact = costCenterRefs.find(
    (ref) => ref.companyCode === companyCode && ref.code === `CC-${companyCode}-${suffix}`,
  );
  if (exact) {
    return exact;
  }
  const fallback = costCenterRefs.find((ref) => ref.companyCode === companyCode);
  if (!fallback) {
    throw new Error(`La sociedad ${companyCode} no tiene centros de coste`);
  }
  return fallback;
}

/** Sufijo de CECO afin a cada categoria de compra. */
export function costCenterSuffixForCategory(categoryCode: string): string {
  switch (categoryCode) {
    case 'IT-CLOUD':
    case 'IT-TELCO':
      return 'IT-INFRA';
    case 'IT-HARDWARE':
      return 'IT-WORKPLACE';
    case 'IT-SECURITY':
      return 'IT-SEC';
    case 'GEN-MARKETING':
      return 'MKT';
    case 'GEN-FACILITIES':
      return 'FAC';
    default:
      return 'IT-APPS';
  }
}
