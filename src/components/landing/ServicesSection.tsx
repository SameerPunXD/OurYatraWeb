import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bike, Car, UtensilsCrossed, Package, ArrowRight, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import bikeImg from "@/assets/service-bike.png";
import carImg from "@/assets/service-car.png";
import foodImg from "@/assets/service-food.png";
import parcelImg from "@/assets/service-parcel.png";

const services = [
  {
    id: "bike",
    icon: Bike,
    title: "Bike Rides",
    image: bikeImg,
    features: [
      "Beat traffic with quick two-wheeler rides",
      "Affordable fares for daily commutes",
      "Arrive in minutes, not hours",
    ],
  },
  {
    id: "car",
    icon: Car,
    title: "Car Rides",
    image: carImg,
    features: [
      "AC comfort for longer journeys",
      "Multiple vehicle options available",
      "Perfect for groups and families",
    ],
  },
  {
    id: "food",
    icon: UtensilsCrossed,
    title: "Food Delivery",
    image: foodImg,
    features: [
      "Order from your favourite restaurants",
      "Track delivery in real-time",
      "Fresh food, delivered fast",
    ],
  },
  {
    id: "parcel",
    icon: Package,
    title: "Parcel Delivery",
    image: parcelImg,
    features: [
      "Send anything across the city",
      "Real-time package tracking",
      "Safe, insured deliveries",
    ],
  },
];

const ServicesSection = () => {
  const [activeTab, setActiveTab] = useState(0);
  const active = services[activeTab];

  return (
    <section id="services" className="py-12 md:py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-10">
        {/* Heading */}
        <div className="text-center mb-10">
          <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight text-foreground">
            The OurYatra Platform
          </h2>
          <p className="text-muted-foreground text-base mt-2 max-w-md mx-auto">
            Everything you need to move — rides, food, and deliveries.
          </p>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap justify-center gap-2 mb-10">
          {services.map((s, i) => (
            <button
              key={s.id}
              onClick={() => setActiveTab(i)}
              className={`flex items-center gap-2 px-4 sm:px-6 py-3 rounded-lg text-sm font-semibold transition-all duration-200 ${
                i === activeTab
                  ? "bg-primary text-primary-foreground shadow-md"
                  : "bg-secondary text-muted-foreground hover:bg-accent"
              }`}
            >
              <s.icon className="w-4 h-4" />
              <span className="hidden sm:inline">{s.title}</span>
            </button>
          ))}
        </div>

        {/* Content panel — no card wrapper */}
        <AnimatePresence mode="wait">
          <motion.div
            key={active.id}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.35 }}
            className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-10 items-center"
          >
            {/* Features */}
            <div className="space-y-5">
              <h3 className="text-2xl md:text-3xl font-extrabold tracking-tight text-foreground">
                {active.title}
              </h3>
              <ul className="space-y-3">
                {active.features.map((f, i) => (
                  <motion.li
                    key={f}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.1 }}
                    className="flex items-start gap-3"
                  >
                    <CheckCircle2 className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                    <span className="text-sm text-muted-foreground leading-relaxed">{f}</span>
                  </motion.li>
                ))}
              </ul>
              <Button className="rounded-lg font-bold h-10 px-6 text-base group mt-2" asChild>
                <Link to="/signup?role=rider">
                  Learn More
                  <ArrowRight className="w-4 h-4 ml-1 transition-transform group-hover:translate-x-1" />
                </Link>
              </Button>
            </div>

            {/* Image */}
            <div className="relative flex justify-center md:justify-end">
              {/* Subtle background blob */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 rounded-full bg-primary/5" />
              <motion.img
                key={active.id + "-img"}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4 }}
                src={active.image}
                alt={active.title}
                className="w-full max-w-md lg:max-w-lg object-contain relative z-10"
                loading="lazy"
              />
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  );
};

export default ServicesSection;
