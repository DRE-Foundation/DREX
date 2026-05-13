import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';
import * as XLSX from 'xlsx';

type SheetRow = Record<string, unknown>;

// ─── Leitura bruta ────────────────────────────────────────────────────────────

export async function readAssetAsText(file: DocumentPicker.DocumentPickerAsset): Promise<string> {
  if (Platform.OS === 'web') {
    if (file.file?.text) return file.file.text();
    return (await fetch(file.uri)).text();
  }

  if (file.file?.text) return file.file.text();

  try {
    return await FileSystem.readAsStringAsync(file.uri);
  } catch (e) {
    console.log('FileSystem text read failed', e);
  }

  return (await fetch(file.uri)).text();
}

export async function readAssetAsWorkbook(file: DocumentPicker.DocumentPickerAsset): Promise<XLSX.WorkBook> {
  if (Platform.OS === 'web') {
    if (file.file?.arrayBuffer) return XLSX.read(await file.file.arrayBuffer(), { type: 'array' });
    return XLSX.read(await (await fetch(file.uri)).arrayBuffer(), { type: 'array' });
  }

  if (file.file?.arrayBuffer) return XLSX.read(await file.file.arrayBuffer(), { type: 'array' });
  if (file.base64) return XLSX.read(file.base64, { type: 'base64' });

  try {
    const fileContent = await FileSystem.readAsStringAsync(file.uri, { encoding: 'base64' });
    return XLSX.read(fileContent, { type: 'base64' });
  } catch (e) {
    console.log('FileSystem base64 read failed', e);
  }

  return XLSX.read(await (await fetch(file.uri)).arrayBuffer(), { type: 'array' });
}

export async function readAssetAsBase64(file: DocumentPicker.DocumentPickerAsset): Promise<string> {
  if (file.base64) return file.base64;

  if (Platform.OS === 'web') {
    const buf = await (await fetch(file.uri)).arrayBuffer();
    const bytes = new Uint8Array(buf);
    let bin = '';
    bytes.forEach((b) => (bin += String.fromCharCode(b)));
    return btoa(bin);
  }

  return FileSystem.readAsStringAsync(file.uri, { encoding: 'base64' });
}

// ─── Conversão para linhas ────────────────────────────────────────────────────

export function workbookToRows(workbook: XLSX.WorkBook): SheetRow[] {
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) return [];
  return XLSX.utils.sheet_to_json<SheetRow>(workbook.Sheets[firstSheetName], { defval: '' });
}

export async function getRowsFromPickedFile(
  file: DocumentPicker.DocumentPickerAsset,
  isCsv: boolean,
  csvToRows: (content: string) => SheetRow[],
): Promise<SheetRow[]> {
  if (isCsv) {
    try {
      const csvRows = csvToRows(await readAssetAsText(file));
      if (csvRows.length) return csvRows;
    } catch (e) {
      console.log('CSV text parse failed', e);
    }
  }

  return workbookToRows(await readAssetAsWorkbook(file));
}