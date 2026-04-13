import { useCountUp } from "@/hooks/useCountUp";
import { motion, useInView } from "framer-motion";
import { useRef } from "react";

const stats = [
  { value: 12847, suffix: "+", label: "Rides today" },
  { value: 3200, suffix: "+", label: "Active drivers" },
  { value: 4, suffix: "min", label: "Avg. pickup" },
  { value: 15, suffix: "", label: "Cities" },
];

const ActivitySection = () => {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section className="py-0 overflow-hidden">
      {/* Marquee banner */}
      <div className="bg-foreground text-primary-foreground py-4 overflow-hidden">
        <div className="animate-marquee whitespace-nowrap flex">
          {[...Array(2)].map((_, j) => (
            <span key={j} className="flex items-center gap-12 mr-12">
              {["Bike rides", "Car rides", "Food delivery", "Parcel delivery", "15 cities", "3200+ drivers"].map((item, i) => (
                <span key={i} className="flex items-center gap-3 text-sm font-medium tracking-wide">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                  {item}
                </span>
              ))}
            </span>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div ref={ref} className="container mx-auto px-6 md:px-10 py-20 md:py-28">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-y-12">
          {stats.map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className="text-center"
            >
              <StatValue stat={stat} inView={inView} />
              <p className="text-xs md:text-sm font-medium text-muted-foreground tracking-wide uppercase mt-2">
                {stat.label}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

const StatValue = ({ stat, inView }: { stat: (typeof stats)[number]; inView: boolean }) => {
  const count = useCountUp(stat.value, inView);
  return (
    <div className="text-5xl md:text-7xl lg:text-8xl font-black tracking-[-0.04em] text-foreground">
      {count.toLocaleString()}
      <span className="text-primary">{stat.suffix}</span>
    </div>
  );
};

export default ActivitySection;
