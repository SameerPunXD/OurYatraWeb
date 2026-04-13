import { motion, useInView, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { ArrowRight, Star } from "lucide-react";
import stepSignup from "@/assets/driver-step-signup.png";
import stepOnline from "@/assets/driver-step-online.png";
import stepDeliver from "@/assets/driver-step-deliver.png";
import stepCashout from "@/assets/driver-step-cashout.png";

const steps = [
  { title: "Sign up in minutes", description: "Quick verification, start earning fast.", image: stepSignup },
  { title: "Go online anytime", description: "Flexible hours — drive on your schedule.", image: stepOnline },
  { title: "Pick up & deliver", description: "Users, food, or parcels — your choice.", image: stepDeliver },
  { title: "Cash out instantly", description: "Earn and withdraw anytime you want.", image: stepCashout },
];

const testimonial = {
  quote: "I've been driving with OurYatra for 8 months. The flexible hours let me spend time with my family while earning a great income. Best decision I've made.",
  name: "Ramesh K.",
  role: "OurYatra Driver, Kathmandu",
  rating: 5,
};

const DriverSection = () => {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });
  const timelineRef = useRef(null);
  const { scrollYProgress } = useScroll({
    target: timelineRef,
    offset: ["start 0.85", "end 0.5"],
  });
  const lineHeight = useTransform(scrollYProgress, [0, 1], ["0%", "100%"]);

  return (
    <section id="drive" className="py-16 md:py-24 bg-secondary/30 overflow-x-clip">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-10">
        <div ref={ref} className="grid grid-cols-1 lg:grid-cols-2 gap-10 md:gap-12 lg:gap-16 items-start">
          {/* Left — Steps */}
          <motion.div
            initial={{ opacity: 0, x: -24 }}
            animate={inView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="space-y-8"
          >
            <div>
              <h2 className="text-3xl md:text-4xl lg:text-5xl font-extrabold tracking-tight text-foreground">
                Earn With OurYatra
              </h2>
              <p className="text-muted-foreground text-base max-w-md leading-relaxed mt-3">
                Thousands of drivers are already earning. Flexible schedule, fair pay, instant cashout.
              </p>
            </div>

            {/* Timeline steps with illustrations */}
            <div ref={timelineRef} className="relative space-y-6 pl-2">
              {/* Animated vertical line */}
              <div className="absolute left-[39px] top-2 bottom-2 w-0.5 bg-border" />
              <motion.div
                className="absolute left-[39px] top-2 w-0.5 bg-primary origin-top"
                style={{ height: lineHeight }}
              />

              {steps.map((step, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -16 }}
                  animate={inView ? { opacity: 1, x: 0 } : {}}
                  transition={{ duration: 0.5, delay: 0.25 + i * 0.12, ease: [0.22, 1, 0.36, 1] }}
                  className="flex items-start gap-4 relative"
                >
                  {/* Step illustration */}
                  <motion.div
                    className="w-20 h-20 rounded-xl overflow-hidden bg-background shadow-sm shrink-0 relative z-10"
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={inView ? { scale: 1, opacity: 1 } : {}}
                    transition={{ duration: 0.4, delay: 0.3 + i * 0.12, type: "spring", stiffness: 200 }}
                  >
                    <img src={step.image} alt={step.title} className="w-full h-full object-contain" loading="lazy" />
                  </motion.div>
                  <div className="pt-2">
                    <span className="text-xs font-bold text-primary">STEP {i + 1}</span>
                    <h4 className="text-sm font-bold text-foreground mt-0.5">{step.title}</h4>
                    <p className="text-sm text-muted-foreground">{step.description}</p>
                  </div>
                </motion.div>
              ))}
            </div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.4, delay: 0.8 }}
            >
              <Button className="rounded-lg font-semibold h-12 px-8 text-sm group" asChild>
                <Link to="/signup?role=driver">
                  Start Earning
                  <ArrowRight className="w-4 h-4 ml-1 transition-transform group-hover:translate-x-1" />
                </Link>
              </Button>
            </motion.div>
          </motion.div>

          {/* Right — Testimonial */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={inView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.7, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="flex flex-col gap-8 lg:pt-12"
          >
            {/* Testimonial card */}
            <div className="bg-background rounded-2xl p-8 shadow-[0_4px_24px_rgba(0,0,0,0.06)] border border-border relative">
              {/* Quote mark */}
              <div className="text-6xl font-black text-primary/10 leading-none absolute top-4 right-6 select-none">
                "
              </div>

              {/* Stars */}
              <div className="flex gap-1 mb-4">
                {[...Array(testimonial.rating)].map((_, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, scale: 0 }}
                    animate={inView ? { opacity: 1, scale: 1 } : {}}
                    transition={{ delay: 0.6 + i * 0.08, type: "spring", stiffness: 300 }}
                  >
                    <Star className="w-4 h-4 fill-primary text-primary" />
                  </motion.div>
                ))}
              </div>

              <p className="text-foreground/80 text-base leading-relaxed italic mb-6">
                "{testimonial.quote}"
              </p>

              <div>
                <p className="font-bold text-foreground text-sm">{testimonial.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{testimonial.role}</p>
              </div>
            </div>

            {/* Quick stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
              {[
                { value: "3,200+", label: "Active Drivers" },
                { value: "₹850", label: "Avg. Daily Earning" },
                { value: "4.8★", label: "Driver Rating" },
              ].map((stat, i) => (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, y: 16 }}
                  animate={inView ? { opacity: 1, y: 0 } : {}}
                  transition={{ duration: 0.4, delay: 0.7 + i * 0.1 }}
                  className="text-center bg-background rounded-xl p-4 border border-border"
                >
                  <div className="text-lg font-black text-foreground">{stat.value}</div>
                  <p className="text-xs text-muted-foreground mt-1">{stat.label}</p>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default DriverSection;
