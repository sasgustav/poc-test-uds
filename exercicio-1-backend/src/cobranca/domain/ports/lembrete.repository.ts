import type { Lembrete } from '../entities/lembrete';

export interface LembreteRepository {
  salvarVarios(lembretes: Lembrete[]): Promise<void>;
  atualizar(lembrete: Lembrete): Promise<void>;
  /**
   * Busca lembretes elegíveis para envio (pendentes + proximaTentativa <= now)
   * utilizando SELECT ... FOR UPDATE SKIP LOCKED para concorrência segura.
   */
  buscarProntosParaEnvio(limit: number): Promise<Lembrete[]>;
}
