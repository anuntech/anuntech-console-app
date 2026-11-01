"use client";
import { useState } from "react";
import { ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MAIL_FRAME_SANDBOX, mailDocument } from "@/lib/mail/mail-document";
import { linkify } from "@/lib/mail/mail-rules";

/**
 * A message's body. HTML (already cleaned on the server) goes into a
 * sandboxed iframe through srcdoc: no scripts and an opaque origin, with a
 * policy that loads nothing but inline styles and data: images. Remote
 * images wait for "Mostrar imagens", which lets https: images in for this
 * message only.
 *
 * Height: the frame fills the reading pane and scrolls inside. A sandbox
 * without allow-same-origin keeps the page from measuring the document, and
 * a script inside would defeat the sandbox, so the frame does not grow to its
 * content; the pane is already as tall as the screen allows.
 *
 * Text-only messages render here, with line breaks kept and links clickable.
 */
export function MessageBody({ html, text, remoteImages, subject }: { html: string | null; text: string | null; remoteImages: boolean; subject: string }) {
  const [showImages, setShowImages] = useState(false);
  if (html !== null)
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        {remoteImages && !showImages && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b bg-secondary/60 px-4 py-2 text-sm text-muted-foreground">
            <span>As imagens de fora estão bloqueadas, para quem enviou não saber que você abriu.</span>
            <Button type="button" variant="outline" size="sm" onClick={() => setShowImages(true)}>
              <ImageIcon />
              Mostrar imagens
            </Button>
          </div>
        )}
        <iframe
          // A new document when the images are allowed: the policy is read once, on load.
          key={showImages ? "with-images" : "blocked"}
          title={`Conteúdo da mensagem: ${subject || "sem assunto"}`}
          sandbox={MAIL_FRAME_SANDBOX}
          srcDoc={mailDocument(html, { remoteImages: showImages })}
          referrerPolicy="no-referrer"
          className="min-h-[360px] w-full flex-1 border-0 bg-white"
        />
      </div>
    );
  return (
    <div className="min-h-0 flex-1 overflow-auto px-5 py-4">
      <p className="text-sm leading-relaxed break-words whitespace-pre-wrap text-foreground">
        {text
          ? linkify(text).map((piece, index) =>
              "href" in piece ? (
                <a key={index} href={piece.href} target="_blank" rel="noopener noreferrer" className="text-link underline-offset-4 hover:underline">
                  {piece.text}
                </a>
              ) : (
                <span key={index}>{piece.text}</span>
              ),
            )
          : <span className="text-muted-foreground">(mensagem sem texto)</span>}
      </p>
    </div>
  );
}
