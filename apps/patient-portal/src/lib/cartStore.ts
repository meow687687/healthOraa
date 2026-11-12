import type { StoredCartLine } from "../types/shop";

// Cart lines are kept per patient in this browser. There is no cart table yet.
const STORAGE_KEY = "healthoraa.patient.cart.v1";

type CartStore = Record<string, StoredCartLine[]>;

const readStore = (): CartStore => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as CartStore) : {};
  } catch {
    return {};
  }
};

export const readCart = (patientId: string): StoredCartLine[] => readStore()[patientId] ?? [];

export const writeCart = (patientId: string, lines: StoredCartLine[]): void => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...readStore(), [patientId]: lines }));
};
