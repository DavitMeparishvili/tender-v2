"use client";
import { useRef, useState } from "react";
import type { Locale } from "../../localization/config";
import type { AttachmentPreview } from "./tender-sections";
import { TenderIcon } from "./tender-icon";
import { tenderPageCopy } from "./tender-page-copy";
export function TenderGallery({
  photos,
  locale,
}: {
  photos: readonly AttachmentPreview[];
  locale: Locale;
}) {
  const c = tenderPageCopy(locale);
  const dialog = useRef<HTMLDialogElement>(null);
  const [selected, setSelected] = useState(0);
  const open = (index: number) => {
    setSelected(index);
    dialog.current?.showModal();
  };
  return (
    <>
      <div className="tender-photo-grid">
        {photos.slice(0, 4).map((photo, index) =>
          photo.url ? (
            <button
              key={photo.id}
              type="button"
              className="tender-photo"
              onClick={() => open(index)}
              aria-label={`${c.preview} ${photo.originalFileName}`}
            >
              {/* Private media must bypass the public Next image cache. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo.url}
                alt={photo.originalFileName}
                loading="lazy"
              />
              {index === 3 ? (
                <span className="tender-photo-overlay">
                  <TenderIcon name="photo" />
                  {c.viewPhotos.replace("{count}", String(photos.length))}
                </span>
              ) : null}
            </button>
          ) : (
            <div
              key={photo.id}
              className="tender-photo locked"
              aria-label={c.samplePreview}
            >
              {/* A generic public illustration, never a CSS-blurred private file. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/images/tender-preview.jpg" alt="" loading="lazy" />
              {index === Math.min(3, photos.length - 1) ? (
                <span className="tender-photo-overlay">
                  <TenderIcon name="lock" />
                  {photos.length} {c.photos}
                </span>
              ) : null}
            </div>
          ),
        )}
      </div>
      <dialog
        className="tender-gallery-dialog"
        ref={dialog}
        aria-label={c.viewPhotos.replace("{count}", String(photos.length))}
      >
        <form method="dialog">
          <button
            className="tender-button"
            aria-label={
              locale === "ka"
                ? "დახურვა"
                : locale === "ru"
                  ? "Закрыть"
                  : "Close"
            }
          >
            ×
          </button>
        </form>
        {photos[selected]?.url ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              className="tender-gallery-main"
              src={photos[selected].url}
              alt={photos[selected].originalFileName}
            />
            <p>
              {photos[selected].originalFileName} · {selected + 1} /{" "}
              {photos.length}
            </p>
            <div className="tender-gallery-controls">
              <button
                className="tender-button"
                onClick={() =>
                  setSelected((selected + photos.length - 1) % photos.length)
                }
                aria-label={
                  locale === "ka"
                    ? "წინა ფოტო"
                    : locale === "ru"
                      ? "Предыдущее фото"
                      : "Previous photo"
                }
              >
                <TenderIcon name="back" />
              </button>
              <button
                className="tender-button"
                onClick={() => setSelected((selected + 1) % photos.length)}
                aria-label={
                  locale === "ka"
                    ? "შემდეგი ფოტო"
                    : locale === "ru"
                      ? "Следующее фото"
                      : "Next photo"
                }
              >
                <TenderIcon name="arrow" />
              </button>
            </div>
          </>
        ) : null}
      </dialog>
    </>
  );
}
