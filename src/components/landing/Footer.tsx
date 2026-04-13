import { forwardRef } from "react";

const links = [
  { title: "Product", items: ["Ride", "Food", "Parcel", "Business"] },
  { title: "Company", items: ["About", "Careers", "Blog", "Press"] },
  { title: "Safety", items: ["Guidelines", "Insurance", "Support"] },
  { title: "Legal", items: ["Terms", "Privacy", "Cookies"] },
];

const Footer = forwardRef<HTMLElement>((_, ref) => {
  return (
    <footer ref={ref} className="border-t border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-10 py-16">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-8 md:gap-10">
          <div className="col-span-2 md:col-span-1">
            <a href="/" className="text-lg font-bold tracking-tight text-foreground">
              Our<span className="text-primary">Yatra</span>
            </a>
            <p className="text-sm text-muted-foreground mt-3 leading-relaxed max-w-[200px]">
              Move, eat, deliver — one app for everything.
            </p>
          </div>

          {links.map((col) => (
            <div key={col.title}>
              <h4 className="text-[11px] font-semibold tracking-widest uppercase text-muted-foreground mb-4">{col.title}</h4>
              <ul className="space-y-3">
                {col.items.map((link) => (
                  <li key={link}>
                    <a href="#" className="text-sm text-foreground/70 hover:text-foreground transition-colors duration-200">
                      {link}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-16 pt-8 border-t border-border flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} OurYatra. All rights reserved.
          </p>
          <div className="flex gap-6">
            {["Twitter", "Instagram", "LinkedIn"].map((s) => (
              <a key={s} href="#" className="text-xs text-muted-foreground hover:text-foreground transition-colors duration-200">
                {s}
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
});

Footer.displayName = "Footer";

export default Footer;
