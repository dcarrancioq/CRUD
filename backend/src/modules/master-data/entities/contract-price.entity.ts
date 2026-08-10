import { Entity, PrimaryColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Contract } from './contract.entity';

@Entity('contract_prices')
export class ContractPrice {
  @PrimaryColumn()
  id: string;

  @Column({ name: 'contract_id' })
  contractId: string;

  @ManyToOne(() => Contract, (contract) => contract.priceList, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'contract_id' })
  contract: Contract;

  @Column({ name: 'item_code' })
  itemCode: string;

  @Column()
  description: string;

  @Column('decimal', { name: 'unit_price', precision: 12, scale: 2, transformer: { to: (v: number) => v, from: (v: string) => Number(v) } })
  unitPrice: number;

  @Column()
  uom: string;

  @Column({ name: 'max_annual_quantity', nullable: true })
  maxAnnualQuantity: number;
}
