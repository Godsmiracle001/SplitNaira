import { MigrationInterface, QueryRunner } from "typeorm";

export class AddUniqueIndexTransactionHash1760000000005 implements MigrationInterface {
  name = "AddUniqueIndexTransactionHash1760000000005";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_transactions_tx_hash" ON "transactions" ("txHash")`);
  }

  /**
   * Intentionally keeps the index. On databases initialised from the current
   * InitialUserAndTransactionRecord migration the index already existed and
   * `up` was a no-op, so dropping it here would remove the only database guard
   * against duplicate transaction records. The initial migration's `down`
   * drops it when the table itself is removed.
   */
  public async down(_queryRunner: QueryRunner): Promise<void> {}
}
