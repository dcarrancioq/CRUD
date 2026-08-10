import { Entity, PrimaryColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Contract } from './contract.entity';

/**
 * Ambito de un contrato: la sociedad y, opcionalmente, el area que pueden
 * consumirlo. Un contrato con varias filas de ambito da servicio a varias
 * sociedades o areas; sin `orgUnitId` cubre toda la sociedad.
 */
@Entity('contract_scopes')
export class ContractScope {
  @PrimaryColumn()
  id: string;

  @Column({ name: 'contract_id' })
  contractId: string;

  @ManyToOne(() => Contract, (contract) => contract.scopes, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'contract_id' })
  contract: Contract;

  @Column({ name: 'company_id' })
  companyId: string;

  @Column({ name: 'org_unit_id', nullable: true })
  orgUnitId: string;
}
