"use client";
import { useState } from "react";
import { Modal } from "./controls";
export function useDiscard(dirty: boolean, close: () => void) {
  const [confirming, setConfirming] = useState(false);
  return { requestClose: () => dirty ? setConfirming(true) : close(), confirmation: confirming ? <Modal title="Descartar alterações?" onClose={() => setConfirming(false)}><p>As alterações ainda não foram salvas.</p><div className="record-actions"><button className="button secondary" onClick={() => setConfirming(false)}>Continuar editando</button><button className="button danger" onClick={() => { setConfirming(false); close(); }}>Descartar alterações</button></div></Modal> : null };
}
