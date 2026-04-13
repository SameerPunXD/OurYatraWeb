import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ExternalLink, FileText } from "lucide-react";

interface DocumentPreviewDialogProps {
  open: boolean;
  title?: string;
  url: string | null;
  onOpenChange: (open: boolean) => void;
}

const IMAGE_EXTENSIONS = /\.(avif|bmp|gif|jpe?g|png|svg|webp)$/i;
const PDF_EXTENSION = /\.pdf$/i;

const stripUrlSuffix = (url: string) => url.split("#")[0]?.split("?")[0] || url;

const DocumentPreviewDialog = ({
  open,
  title = "Document Preview",
  url,
  onOpenChange,
}: DocumentPreviewDialogProps) => {
  const normalizedUrl = url ? stripUrlSuffix(url) : "";
  const isPdf = PDF_EXTENSION.test(normalizedUrl);
  const isImage = IMAGE_EXTENSIONS.test(normalizedUrl);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        {!url ? null : isPdf ? (
          <iframe
            src={url}
            title={title}
            className="h-[70vh] w-full rounded-lg border"
          />
        ) : isImage ? (
          <img
            src={url}
            alt={title}
            className="max-h-[70vh] w-full rounded-lg object-contain"
          />
        ) : (
          <div className="flex min-h-48 flex-col items-center justify-center gap-3 rounded-lg border border-dashed px-6 text-center">
            <FileText className="h-10 w-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              This file can&apos;t be previewed inline here.
            </p>
          </div>
        )}

        {url && (
          <div className="flex justify-end">
            <Button asChild variant="outline">
              <a href={url} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="mr-2 h-4 w-4" />
                Open in new tab
              </a>
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default DocumentPreviewDialog;
