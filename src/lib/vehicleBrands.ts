export const VEHICLE_TYPES = ["Bike", "Auto", "Scooter", "Car", "Van", "Truck"] as const;

export const OTHER_BRAND_OPTION = "Other";

export const VEHICLE_BRANDS: Record<string, string[]> = {
  Bike: [
    "Honda",
    "Yamaha",
    "Bajaj",
    "TVS",
    "Hero",
    "Suzuki",
    "KTM",
    "Royal Enfield",
    "Benelli",
    "Ducati",
    OTHER_BRAND_OPTION,
  ],
  Scooter: [
    "Honda",
    "TVS",
    "Yamaha",
    "Suzuki",
    "Vespa",
    "Aprilia",
    "Ather",
    "NIU",
    "Bajaj",
    OTHER_BRAND_OPTION,
  ],
  Auto: [
    "Bajaj",
    "TVS",
    "Piaggio",
    "Mahindra",
    "Atul",
    "Force",
    OTHER_BRAND_OPTION,
  ],
  Car: [
    "Toyota",
    "Hyundai",
    "Suzuki",
    "Tata",
    "Mahindra",
    "Honda",
    "Kia",
    "Nissan",
    "Renault",
    "Ford",
    "Volkswagen",
    "Skoda",
    "MG",
    "BYD",
    "Tesla",
    "BMW",
    "Mercedes-Benz",
    "Audi",
    OTHER_BRAND_OPTION,
  ],
  Van: [
    "Maruti Suzuki",
    "Toyota",
    "Tata",
    "Mahindra",
    "Force",
    "Hyundai",
    "Kia",
    OTHER_BRAND_OPTION,
  ],
  Truck: [
    "Tata",
    "Ashok Leyland",
    "Mahindra",
    "Eicher",
    "BharatBenz",
    "Isuzu",
    "Force",
    OTHER_BRAND_OPTION,
  ],
};

export const getVehicleBrands = (vehicleType: string) => VEHICLE_BRANDS[vehicleType] || [OTHER_BRAND_OPTION];

export const normalizeVehicleTypeValue = (value: string) => {
  const normalized = value.trim().toLowerCase();
  return VEHICLE_TYPES.find((type) => type.toLowerCase() === normalized) || "Bike";
};
