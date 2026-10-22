// Placeholder: frente 1 (U1/U2) replaces this with the real picker and upload.
export type PickedFile = { uri: string; name: string; mime: string; size: number };
export type UploadTarget = { kind: "ticket"; companyId: string } | { kind: "task"; engagementId: string };

export async function pickFiles(_source: "camera" | "photos" | "files", _max: number): Promise<PickedFile[]> {
  throw new Error("Envio de arquivos ainda não disponível.");
}

export async function uploadFile(_file: PickedFile, _target: UploadTarget): Promise<{ uploadId: string }> {
  throw new Error("Envio de arquivos ainda não disponível.");
}
