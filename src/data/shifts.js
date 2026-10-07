import { getBusinessDate } from "../utils/utils.js";

// Stored business dates remain authoritative for shifts created under older settings.
export function hasShiftForBusinessDate(shifts, definition, businessDate, startHour = 8) {
  return (shifts || []).some((shift) => {
    const sameDefinition = (definition.defId || definition.id)
      && shift.defId === (definition.defId || definition.id);
    const sameName = definition.name && shift.name?.trim() === definition.name.trim();
    const date = shift.businessDate || getBusinessDate(shift.startTime, startHour);
    return (sameDefinition || sameName) && date === businessDate;
  });
}
