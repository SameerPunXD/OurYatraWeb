import { Mail, Phone, MessageCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const faqs = [
  { q: "How do I go online?", a: "Toggle the online switch on your dashboard to start receiving ride and parcel requests." },
  { q: "How do I choose my service mode?", a: "On your dashboard, select 'Ride Only', 'Parcel Only', or 'Both' under Service Mode to control which requests you receive." },
  { q: "How do I accept a request?", a: "When a new ride or parcel request appears, tap 'Accept' to claim the job. You can then start the trip or delivery." },
  { q: "How are earnings calculated?", a: "Your earnings are based on the fare for each completed ride or delivery. Visit the Earnings page for detailed breakdowns." },
  { q: "How do I upload my documents?", a: "Go to 'Vehicle & Documents' in the sidebar. Upload your profile photo, vehicle photo, registration, and national ID for verification." },
  { q: "What if my account is pending verification?", a: "After uploading your documents, our team will review and verify your account. This usually takes 1-2 business days." },
  { q: "How do subscriptions work?", a: "Visit the 'Subscription' page to view available driver plans. Active subscriptions provide benefits like priority job matching." },
];

const DriverSupport = () => {
  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Driver Support</h2>
        <p className="text-muted-foreground">Get help with your driver account</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-5 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Phone className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Call Us</p>
              <p className="text-sm text-muted-foreground">+977 01-XXXXXXX</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Mail className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Email</p>
              <p className="text-sm text-muted-foreground">drivers@ouryatra.com</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <MessageCircle className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Live Chat</p>
              <p className="text-sm text-muted-foreground">Coming soon</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Frequently Asked Questions</CardTitle>
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible className="w-full">
            {faqs.map((faq, i) => (
              <AccordionItem key={i} value={`faq-${i}`}>
                <AccordionTrigger className="text-left text-sm">{faq.q}</AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground">{faq.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </CardContent>
      </Card>
    </div>
  );
};

export default DriverSupport;
