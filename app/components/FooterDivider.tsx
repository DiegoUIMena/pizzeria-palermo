import Image from "next/image"

export default function FooterDivider() {
  return (
    <div
      className="w-full"
      style={{
        backgroundImage: 'url(/banners/footer.jpg)',
        backgroundRepeat: 'repeat-x',
        backgroundSize: 'auto 100%',
        backgroundPosition: 'center',
        height: 'auto',
        minHeight: '100px'
      }}
    >
      <Image
        src="/banners/footer.jpg"
        alt="Guarda Pizzería Palermo"
        width={1200}
        height={300}
        className="invisible"
        quality={90}
      />
    </div>
  )
}
