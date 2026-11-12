import type { DeviceBooking } from "../types/consultations";

// Bookings that could not be sent to the clinic. Kept in this browser and labelled as such.
const STORAGE_KEY = "healthoraa.patient.bookings.v1";

const readAll = (): DeviceBooking[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as DeviceBooking[]) : [];
  } catch {
    return [];
  }
};

export const readDeviceBookings = (): DeviceBooking[] => readAll();

export const appendDeviceBooking = (booking: DeviceBooking): void => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...readAll(), booking]));
};

export const deviceBookedSlotIds = (): Set<string> => new Set(readAll().map((booking) => booking.slotId));
