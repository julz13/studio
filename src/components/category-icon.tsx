import { Utensils, Car, ShoppingCart, Clapperboard, Home, HelpCircle, Landmark } from "lucide-react";
import type { Payment } from "@/lib/types";

interface CategoryIconProps {
  category: Payment['category'];
  className?: string;
}

export function CategoryIcon({ category, className }: CategoryIconProps) {
  const iconMap = {
    Food: Utensils,
    Transport: Car,
    Shopping: ShoppingCart,
    Entertainment: Clapperboard,
    Utilities: Home,
    Withdrawal: Landmark,
    Other: HelpCircle,
  };

  const Icon = iconMap[category] || HelpCircle;
  return <Icon className={className} />;
}

    