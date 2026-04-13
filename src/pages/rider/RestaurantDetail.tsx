import { useEffect, useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useFoodCart } from "@/contexts/FoodCartContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { UtensilsCrossed, Star, Clock, MapPin, ShoppingCart, Plus, Minus, ArrowLeft } from "lucide-react";

const RestaurantDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { cart, addItem, updateQuantity, totalItems, totalAmount } = useFoodCart();
  const [restaurant, setRestaurant] = useState<any>(null);
  const [menuItems, setMenuItems] = useState<any[]>([]);
  const [activeCategory, setActiveCategory] = useState("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      supabase.from("restaurants").select("*").eq("id", id).single(),
      supabase.from("menu_items").select("*").eq("restaurant_id", id).eq("is_available", true),
    ]).then(([{ data: r }, { data: items }]) => {
      setRestaurant(r);
      setMenuItems(items || []);
      setLoading(false);
    });
  }, [id]);

  const categories = useMemo(() => {
    const cats = new Set(menuItems.map((i) => i.category).filter(Boolean));
    return Array.from(cats).sort();
  }, [menuItems]);

  const filteredItems = activeCategory === "all" ? menuItems : menuItems.filter((i) => i.category === activeCategory);

  const getCartQty = (itemId: string) => cart.items.find((i) => i.id === itemId)?.quantity || 0;

  if (loading) return <p className="text-muted-foreground">Loading...</p>;
  if (!restaurant) return <p className="text-destructive">Restaurant not found</p>;

  return (
    <div className="space-y-6 pb-24">
      {/* Back button */}
      <Button variant="ghost" size="sm" onClick={() => navigate("/rider/food")} className="gap-1">
        <ArrowLeft className="h-4 w-4" /> Back
      </Button>

      {/* Restaurant Header */}
      <div className="rounded-lg overflow-hidden">
        {restaurant.image_url ? (
          <img src={restaurant.image_url} alt={restaurant.name} className="w-full h-48 object-cover" />
        ) : (
          <div className="w-full h-48 bg-muted flex items-center justify-center">
            <UtensilsCrossed className="h-16 w-16 text-muted-foreground" />
          </div>
        )}
      </div>
      <div>
        <h2 className="text-2xl font-bold text-foreground">{restaurant.name}</h2>
        {restaurant.cuisine_type && <p className="text-muted-foreground">{restaurant.cuisine_type}</p>}
        <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
          {(restaurant.rating || 0) > 0 && <span className="flex items-center gap-1"><Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />{Number(restaurant.rating).toFixed(1)}</span>}
          {restaurant.estimated_delivery_time && <span className="flex items-center gap-1"><Clock className="h-4 w-4" />{restaurant.estimated_delivery_time}</span>}
          {restaurant.address && <span className="flex items-center gap-1"><MapPin className="h-4 w-4" />{restaurant.address}</span>}
        </div>
        {restaurant.description && <p className="text-sm text-muted-foreground mt-2">{restaurant.description}</p>}
      </div>

      {/* Category Tabs */}
      {categories.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <Badge variant={activeCategory === "all" ? "default" : "outline"} className="cursor-pointer" onClick={() => setActiveCategory("all")}>All</Badge>
          {categories.map((c) => (
            <Badge key={c} variant={activeCategory === c ? "default" : "outline"} className="cursor-pointer" onClick={() => setActiveCategory(c)}>{c}</Badge>
          ))}
        </div>
      )}

      {/* Menu Items */}
      {filteredItems.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-muted-foreground">No items available</CardContent></Card>
      ) : (
        <div className="grid gap-3">
          {filteredItems.map((item) => {
            const qty = getCartQty(item.id);
            return (
              <Card key={item.id}>
                <CardContent className="p-4 flex gap-4">
                  {item.image_url ? (
                    <img src={item.image_url} alt={item.name} className="w-20 h-20 rounded-md object-cover flex-shrink-0" />
                  ) : (
                    <div className="w-20 h-20 rounded-md bg-muted flex items-center justify-center flex-shrink-0">
                      <UtensilsCrossed className="h-6 w-6 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground">{item.name}</p>
                    {item.description && <p className="text-sm text-muted-foreground line-clamp-2">{item.description}</p>}
                    <p className="text-sm font-semibold text-primary mt-1">Rs {item.price}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {qty > 0 ? (
                      <>
                        <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => updateQuantity(item.id, -1)}><Minus className="h-3 w-3" /></Button>
                        <span className="w-6 text-center font-semibold">{qty}</span>
                        <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => updateQuantity(item.id, 1)}><Plus className="h-3 w-3" /></Button>
                      </>
                    ) : (
                      <Button size="sm" variant="outline" onClick={() => addItem({ id: item.id, name: item.name, price: item.price, image_url: item.image_url }, restaurant.id, restaurant.name)}>
                        <Plus className="h-3 w-3 mr-1" /> Add
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Sticky Cart Bar */}
      {totalItems > 0 && cart.restaurantId === id && (
        <div className="fixed bottom-0 left-0 right-0 bg-primary text-primary-foreground p-4 pb-[max(1rem,env(safe-area-inset-bottom))] flex items-center justify-between z-50 shadow-lg">
          <div>
            <p className="font-semibold flex items-center gap-2"><ShoppingCart className="h-4 w-4" /> {totalItems} items</p>
            <p className="text-sm opacity-90">Rs {totalAmount + 50} (incl. delivery)</p>
          </div>
          <Button variant="secondary" onClick={() => navigate("/rider/food/checkout")}>View Cart</Button>
        </div>
      )}
    </div>
  );
};

export default RestaurantDetail;
