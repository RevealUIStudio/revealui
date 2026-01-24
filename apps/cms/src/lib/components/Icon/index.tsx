import Image from 'next/image'

const Icon = () => (
  <div className="flex justify-center">
    <Image
      className="m-auto h-12 w-12 rounded-full"
      src="https://res.cloudinary.com/dpytkhyme/image/upload/v1718044729/STREETBEEFS%20SCRAPYARD/streetbeefs-scrapyard-logo-6_jcfv5l.webp"
      alt="Streetbeefs Scrapyard Logo"
      width={48}
      height={48}
      unoptimized
    />
  </div>
)

export default Icon
