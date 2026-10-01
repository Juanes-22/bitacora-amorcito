import { useBitacora } from "../../app/BitacoraProvider";
import { Modal } from "./Modal";

/**
 * Confirmación del reinicio (SPEC 13.3): acción destructiva, así que es un `alertdialog` cuyo foco inicial va
 * a «Cancelar». Escape cancela. Explica qué se borra y que no se puede deshacer.
 */
export function ConfirmDialog({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
  const { config } = useBitacora();
  const { labels } = config.ui;
  return (
    <Modal labelledBy="confirm-title" role="alertdialog" onEscape={onCancel} className="reading--narrow">
      <div className="reading__header">
        <h2 id="confirm-title" className="reading__title">{labels.resetConfirmTitle}</h2>
      </div>
      <div className="reading__body">
        <p className="reading__line">{labels.resetConfirmText}</p>
      </div>
      <div className="reading__footer">
        <button type="button" className="reading__close" onClick={onCancel} data-autofocus>{labels.cancel}</button>
        <button type="button" className="reading__close confirm__danger" onClick={onConfirm}>{labels.resetConfirm}</button>
      </div>
    </Modal>
  );
}
