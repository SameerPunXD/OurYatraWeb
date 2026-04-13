import { motion } from "framer-motion";
import { ArrowRight, Bike, Car, UtensilsCrossed, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCountUp } from "@/hooks/useCountUp";
import { Link } from "react-router-dom";
import heroImg from "@/assets/hero-ride.png";

const stats = [
  { value: 12847, label: "Rides Completed" },
  { value: 3200, label: "Active Drivers" },
  { value: 15, label: "Cities" },
];

const floatingIcons = [
  { icon: Bike, top: "10%", right: "8%", delay: 0.6 },
  { icon: Car, top: "55%", right: "2%", delay: 0.8 },
  { icon: UtensilsCrossed, top: "5%", right: "42%", delay: 1.0 },
  { icon: Package, top: "65%", right: "38%", delay: 1.2 },
];

const HeroSection = () => {
  return (
    <section className="relative overflow-x-clip pt-16 md:pt-20">
      <div className="absolute inset-0 z-0 overflow-hidden">
        <motion.div
          initial={{ x: "100%", opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
          className="absolute top-0 right-0 w-[60%] md:w-[45%] h-full bg-primary"
          style={{ clipPath: "polygon(20% 0, 100% 0, 100% 100%, 0% 100%)" }}
        />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-10 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8 items-end py-10 md:py-16">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            className="space-y-6 pb-6 sm:pb-8 lg:pb-16"
          >
            <h1 className="text-3xl sm:text-5xl md:text-6xl lg:text-7xl font-black leading-[1.05] tracking-tight text-foreground break-words">
              Move Your City
              <br />
              with <span className="text-primary">OurYatra</span>
            </h1>
            <p className="text-foreground/60 text-base md:text-lg max-w-md leading-relaxed">
              Rides, food, parcels — all in one app. Fast pickups, fair prices, everywhere you need to be.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button size="lg" className="rounded-lg font-semibold px-8 h-12 text-sm group" asChild>
                <Link to="/signup">
                  Get Started
                  <ArrowRight className="w-4 h-4 ml-1 transition-transform group-hover:translate-x-1" />
                </Link>
              </Button>
              <Button variant="outline" size="lg" className="rounded-lg font-semibold px-8 h-12 text-sm" asChild>
                <Link to="/signup?role=driver">Earn with Us</Link>
              </Button>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="relative flex justify-center lg:justify-end self-end w-full"
          >
            <div className="relative w-full max-w-xl lg:max-w-2xl">
              <img src={heroImg} alt="OurYatra ride-hailing" className="w-full object-contain relative z-10" />
              {floatingIcons.map((item, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.5, delay: item.delay, type: "spring", stiffness: 200 }}
                  className="absolute z-20 w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-background shadow-xl flex items-center justify-center"
                  style={{ top: item.top, right: item.right }}
                >
                  <item.icon className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-10 relative z-20 -mt-2 md:-mt-4 pb-8">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.5 }}
          className="bg-background rounded-xl shadow-[0_4px_24px_rgba(0,0,0,0.08)] border border-border p-6 md:p-8"
        >
          <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-border">
            {stats.map((stat, i) => (
              <StatItem key={stat.label} stat={stat} delay={i * 0.15} />
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
};

const StatItem = ({ stat, delay }: { stat: (typeof stats)[number]; delay: number }) => {
  const count = useCountUp(stat.value, true);
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.8 + delay }}
      className="text-center px-4 md:px-8 py-3 sm:py-0"
    >
      <div className="text-2xl sm:text-3xl md:text-5xl font-black text-foreground tracking-tight">
        {count.toLocaleString()}
        <span className="text-primary">+</span>
      </div>
      <p className="text-xs md:text-sm text-muted-foreground font-medium mt-2">{stat.label}</p>
    </motion.div>
  );
};

export default HeroSection;
