import { createContext, useContext, useState, ReactNode } from "react";

export interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  image_url?: string | null;
}

interface FoodCart {
  restaurantId: string | null;
  restaurantName: string;
  items: CartItem[];
}

interface FoodCartContextType {
  cart: FoodCart;
  addItem: (item: Omit<CartItem, "quantity">, restaurantId: string, restaurantName: string) => void;
  removeItem: (itemId: string) => void;
  updateQuantity: (itemId: string, delta: number) => void;
  clearCart: () => void;
  totalItems: number;
  totalAmount: number;
}

const emptyCart: FoodCart = { restaurantId: null, restaurantName: "", items: [] };

const FoodCartContext = createContext<FoodCartContextType | undefined>(undefined);

export const FoodCartProvider = ({ children }: { children: ReactNode }) => {
  const [cart, setCart] = useState<FoodCart>(emptyCart);

  const addItem = (item: Omit<CartItem, "quantity">, restaurantId: string, restaurantName: string) => {
    setCart((prev) => {
      // If switching restaurant, clear cart
      if (prev.restaurantId && prev.restaurantId !== restaurantId) {
        return { restaurantId, restaurantName, items: [{ ...item, quantity: 1 }] };
      }
      const existing = prev.items.find((i) => i.id === item.id);
      if (existing) {
        return {
          ...prev, restaurantId, restaurantName,
          items: prev.items.map((i) => i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i),
        };
      }
      return { ...prev, restaurantId, restaurantName, items: [...prev.items, { ...item, quantity: 1 }] };
    });
  };

  const removeItem = (itemId: string) => {
    setCart((prev) => {
      const items = prev.items.filter((i) => i.id !== itemId);
      return items.length === 0 ? emptyCart : { ...prev, items };
    });
  };

  const updateQuantity = (itemId: string, delta: number) => {
    setCart((prev) => {
      const items = prev.items
        .map((i) => (i.id === itemId ? { ...i, quantity: i.quantity + delta } : i))
        .filter((i) => i.quantity > 0);
      return items.length === 0 ? emptyCart : { ...prev, items };
    });
  };

  const clearCart = () => setCart(emptyCart);

  const totalItems = cart.items.reduce((s, i) => s + i.quantity, 0);
  const totalAmount = cart.items.reduce((s, i) => s + i.price * i.quantity, 0);

  return (
    <FoodCartContext.Provider value={{ cart, addItem, removeItem, updateQuantity, clearCart, totalItems, totalAmount }}>
      {children}
    </FoodCartContext.Provider>
  );
};

export const useFoodCart = () => {
  const ctx = useContext(FoodCartContext);
  if (!ctx) throw new Error("useFoodCart must be used within FoodCartProvider");
  return ctx;
};
