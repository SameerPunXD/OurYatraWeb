const seatsPerRow = 4;
const seatsPerSidePerRow = 2;
const backRowSeatCount = 5;

export interface BusSeatLayoutRow {
  type: "aisle" | "back";
  leftSeats?: string[];
  rightSeats?: string[];
  seats?: string[];
}

export const getBusSeatLabelFromIndex = (seatIndex: number): string | null => {
  if (!Number.isInteger(seatIndex) || seatIndex < 1) {
    return null;
  }

  const zeroBasedIndex = seatIndex - 1;
  const rowIndex = Math.floor(zeroBasedIndex / seatsPerRow);
  const seatSlotInRow = zeroBasedIndex % seatsPerRow;
  const side = seatSlotInRow < seatsPerSidePerRow ? "A" : "B";
  const seatNumberWithinSide = rowIndex * seatsPerSidePerRow + (seatSlotInRow % seatsPerSidePerRow) + 1;

  return `${side}${seatNumberWithinSide}`;
};

export const getBusSeatIndex = (seatLabel: string): number | null => {
  const normalizedLabel = seatLabel.trim().toUpperCase();

  if (!normalizedLabel) {
    return null;
  }

  if (/^[0-9]+$/.test(normalizedLabel)) {
    const numericSeatIndex = Number(normalizedLabel);
    return Number.isInteger(numericSeatIndex) && numericSeatIndex > 0 ? numericSeatIndex : null;
  }

  const match = normalizedLabel.match(/^([AB])([0-9]+)$/);
  if (!match) {
    return null;
  }

  const [, side, seatNumberValue] = match;
  const seatNumberWithinSide = Number(seatNumberValue);

  if (!Number.isInteger(seatNumberWithinSide) || seatNumberWithinSide < 1) {
    return null;
  }

  const rowIndex = Math.floor((seatNumberWithinSide - 1) / seatsPerSidePerRow);
  const seatOffsetWithinSide = (seatNumberWithinSide - 1) % seatsPerSidePerRow;
  const sideOffset = side === "A" ? 0 : seatsPerSidePerRow;

  return rowIndex * seatsPerRow + sideOffset + seatOffsetWithinSide + 1;
};

export const normalizeBusSeatLabel = (seatLabel: string) => {
  const normalizedLabel = seatLabel.trim().toUpperCase();

  if (!normalizedLabel) {
    return "";
  }

  if (/^[0-9]+$/.test(normalizedLabel)) {
    return getBusSeatLabelFromIndex(Number(normalizedLabel)) || normalizedLabel;
  }

  return normalizedLabel;
};

export const sortBusSeatLabels = (seatLabels: string[]) =>
  Array.from(
    new Set(
      seatLabels
        .map((seatLabel) => normalizeBusSeatLabel(seatLabel))
        .filter(Boolean),
    ),
  ).sort((leftSeat, rightSeat) => {
    const leftIndex = getBusSeatIndex(leftSeat) ?? Number.MAX_SAFE_INTEGER;
    const rightIndex = getBusSeatIndex(rightSeat) ?? Number.MAX_SAFE_INTEGER;

    if (leftIndex !== rightIndex) {
      return leftIndex - rightIndex;
    }

    return leftSeat.localeCompare(rightSeat);
  });

export const buildBusSeatRows = (totalSeats: number) => {
  const seatLabels = Array.from({ length: totalSeats }, (_, index) => getBusSeatLabelFromIndex(index + 1) || String(index + 1));
  const rows: string[][] = [];

  for (let index = 0; index < seatLabels.length; index += seatsPerRow) {
    rows.push(seatLabels.slice(index, index + seatsPerRow));
  }

  return rows;
};

export const buildBusSeatLayout = (totalSeats: number): BusSeatLayoutRow[] => {
  const seatLabels = Array.from({ length: totalSeats }, (_, index) => getBusSeatLabelFromIndex(index + 1) || String(index + 1));
  const aSeats = seatLabels.filter((seatLabel) => seatLabel.startsWith("A"));
  const bSeats = seatLabels.filter((seatLabel) => seatLabel.startsWith("B"));

  if (seatLabels.length === 0) {
    return [];
  }

  if (seatLabels.length <= backRowSeatCount) {
    return [{ type: "back", seats: [...aSeats, ...bSeats] }];
  }

  const backRowLeftSeats = aSeats.slice(-3);
  const backRowRightSeats = bSeats.slice(-2);
  const remainingASeats = aSeats.slice(0, Math.max(0, aSeats.length - backRowLeftSeats.length));
  const remainingBSeats = bSeats.slice(0, Math.max(0, bSeats.length - backRowRightSeats.length));
  const layoutRows: BusSeatLayoutRow[] = [];
  const standardRowCount = Math.min(
    Math.floor(remainingASeats.length / seatsPerSidePerRow),
    Math.floor(remainingBSeats.length / seatsPerSidePerRow),
  );
  let aCursor = 0;
  let bCursor = 0;

  for (let rowIndex = 0; rowIndex < standardRowCount; rowIndex += 1) {
    layoutRows.push({
      type: "aisle",
      leftSeats: remainingASeats.slice(aCursor, aCursor + seatsPerSidePerRow),
      rightSeats: remainingBSeats.slice(bCursor, bCursor + seatsPerSidePerRow),
    });
    aCursor += seatsPerSidePerRow;
    bCursor += seatsPerSidePerRow;
  }

  const partialLeftSeats = remainingASeats.slice(aCursor);
  const partialRightSeats = remainingBSeats.slice(bCursor);
  if (partialLeftSeats.length > 0 || partialRightSeats.length > 0) {
    layoutRows.push({
      type: "aisle",
      leftSeats: partialLeftSeats,
      rightSeats: partialRightSeats,
    });
  }

  layoutRows.push({
    type: "back",
    seats: [...backRowLeftSeats, ...backRowRightSeats],
  });

  return layoutRows;
};
