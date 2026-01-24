import Image from 'next/image'

const Logo = () => (
  <div className="flex flex-col items-center">
    <Image
      className="m-auto h-52 w-52 rounded-full"
      src="https://res.cloudinary.com/dpytkhyme/image/upload/v1718044729/STREETBEEFS%20SCRAPYARD/streetbeefs-scrapyard-logo-6_jcfv5l.webp"
      alt="Streetbeefs Scrapyard Logo"
      width={208}
      height={208}
      unoptimized
    />
    <h1 className="mt-5 text-center text-4xl font-bold lg:text-6xl">Streetbeefs Scrapyard</h1>
  </div>
)

export default Logo
