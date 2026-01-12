import Link from 'next/link'

export default function MusicMain() {
  return (
    <main className="bg-scrapBlack w-full">
      <section className="bg-scrapBlack dark:bg-scrapBlack w-full py-12 md:py-24 lg:py-32">
        <div className="container px-4 md:px-6">
          <div className="grid gap-6 lg:grid-cols-[1fr_1fr] lg:gap-12">
            <div className="space-y-4">
              <h2 className="text-scrapWhite text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl">
                Music
              </h2>
              <p className="text-scrapWhite dark:text-scrapWhite max-w-[600px] md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed">
                Check out the latest music releases from our talented artists.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="overflow-hidden rounded-lg">
                <img
                  alt="Album Cover"
                  className="aspect-square object-cover"
                  height={300}
                  src="https://res.cloudinary.com/dpytkhyme/image/upload/v1717532164/STREETBEEFS%20SCRAPYARD/DALL_E_2024-06-04_16.15.47_-_Create_an_album_cover_for_the_Streetbeefs_Scrapyard_record_label_named_SCRAPYARD_RECORDS_._The_cover_should_have_an_edgy_gritty_urban_theme_with_ele_hf7ftc.webp"
                  width={300}
                />
                <div className="bg-scrapBlack dark:bg-scrapBlack p-4">
                  <h3 className="text-scrapWhite text-lg font-medium">Album Title</h3>
                  <p className="text-scrapOrange dark:text-scrapOrange">Artist Name</p>
                  <div className="relative mt-4 flex gap-2">
                    <Link
                      className="bg-scrapBlack text-scrapWhite hover:bg-scrapBlack/90 focus-visible:ring-scrapOrange dark:bg-scrapBlack dark:text-scrapWhite dark:hover:bg-scrapBlack/90 dark:focus-visible:ring-scrapYellow inline-flex items-center justify-center rounded-md px-4 text-sm font-medium shadow transition-colors focus-visible:outline-none focus-visible:ring-1 disabled:pointer-events-none disabled:opacity-50"
                      href="#"
                    >
                      Listen on Spotify
                    </Link>
                    <Link
                      className="text-scrapWhite border-scrapWhite bg-scrapBlack hover:bg-scrapBlack hover:text-scrapOrange focus-visible:ring-scrapOrange dark:border-scrapOrange dark:bg-scrapBlack dark:hover:bg-scrapBlack dark:hover:text-scrapWhite dark:focus-visible:ring-scrapWhite inline-flex items-center justify-center rounded-md border px-4 text-sm font-medium shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 disabled:pointer-events-none disabled:opacity-50"
                      href="#"
                    >
                      Listen on Apple Music
                    </Link>
                  </div>
                </div>
              </div>
              <div className="overflow-hidden rounded-lg">
                <img
                  alt="Album Cover"
                  className="aspect-square object-cover"
                  height={300}
                  src="https://res.cloudinary.com/dpytkhyme/image/upload/v1717532164/STREETBEEFS%20SCRAPYARD/DALL_E_2024-06-04_16.15.47_-_Create_an_album_cover_for_the_Streetbeefs_Scrapyard_record_label_named_SCRAPYARD_RECORDS_._The_cover_should_have_an_edgy_gritty_urban_theme_with_ele_hf7ftc.webp"
                  width={300}
                />
                <div className="bg-scrapBlack dark:bg-scrapBlack p-4">
                  <h3 className="text-scrapWhite text-lg font-medium">Album Title</h3>
                  <p className="text-scrapOrange dark:text-scrapOrange">Artist Name</p>
                  <div className="mt-4 flex gap-2">
                    <Link
                      className="bg-scrapBlack text-scrapWhite hover:bg-scrapBlack/90 focus-visible:ring-scrapBlack dark:bg-scrapBlack dark:text-scrapWhite dark:hover:bg-scrapBlack/90 dark:focus-visible:ring-scrapWhite inline-flex items-center justify-center rounded-md px-4 text-sm font-medium shadow transition-colors focus-visible:outline-none focus-visible:ring-1 disabled:pointer-events-none disabled:opacity-50"
                      href="#"
                    >
                      Listen on Spotify
                    </Link>
                    <Link
                      className="text-scrapWhite border-scrapWhite bg-scrapBlack hover:bg-scrapBlack hover:text-scrapYellow focus-visible:ring-scrapBlack dark:border-scrapOrange dark:bg-scrapBlack dark:hover:bg-scrapYellow dark:hover:text-scrapWhite dark:focus-visible:ring-scrapOrange inline-flex items-center justify-center rounded-md border px-4 text-sm font-medium shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 disabled:pointer-events-none disabled:opacity-50"
                      href="#"
                    >
                      Listen on Apple Music
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
      <section className="w-full py-12 md:py-24 lg:py-32">
        <div className="container px-4 md:px-6">
          <div className="space-y-4">
            <h2 className="text-scrapWhite text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl">
              Latest YouTube Videos
            </h2>
            <p className="text-scrapRed dark:text-scrapRed max-w-[600px] md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed">
              Check out the latest videos from our YouTube channel.
            </p>
          </div>
          <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <div className="overflow-hidden rounded-lg">
              <img
                alt="YouTube Thumbnail"
                className="aspect-video object-cover"
                height={225}
                src="https://res.cloudinary.com/dpytkhyme/image/upload/v1717532637/STREETBEEFS%20SCRAPYARD/DALL_E_2024-06-04_16.23.42_-_Create_a_YouTube_video_thumbnail_for_the_streetbeefs_SCRAPYARD_channel._The_thumbnail_should_feature_a_gritty_urban_theme_with_elements_of_a_scrapyar_kyoayo.webp"
                width={400}
              />
              <div className="bg-scrapBlack dark:bg-scrapBlack p-4">
                <h3 className="text-scrapWhite text-lg font-medium">Video Title</h3>
                <p className="text-scrapWhite dark:text-scrapWhite">
                  This is a description of the video.
                </p>
                <Link
                  className="bg-scrapBlack text-scrapRed hover:bg-scrapBlack/90 focus-visible:ring-scrapBlack dark:bg-scrapBlack dark:text-scrapRed dark:hover:bg-scrapBlack/90 dark:focus-visible:ring-scrapYellow mt-4 inline-flex h-8 items-center justify-center rounded-md px-4 text-sm font-medium shadow transition-colors focus-visible:outline-none focus-visible:ring-1 disabled:pointer-events-none disabled:opacity-50"
                  href="#"
                >
                  Watch on YouTube
                </Link>
              </div>
            </div>
            <div className="overflow-hidden rounded-lg">
              <img
                alt="YouTube Thumbnail"
                className="aspect-video object-cover"
                height={225}
                src="https://res.cloudinary.com/dpytkhyme/image/upload/v1717532637/STREETBEEFS%20SCRAPYARD/DALL_E_2024-06-04_16.23.42_-_Create_a_YouTube_video_thumbnail_for_the_streetbeefs_SCRAPYARD_channel._The_thumbnail_should_feature_a_gritty_urban_theme_with_elements_of_a_scrapyar_kyoayo.webp"
                width={400}
              />
              <div className="bg-scrapBlack dark:bg-scrapBlack p-4">
                <h3 className="text-scrapWhite text-lg font-medium">Video Title</h3>
                <p className="text-scrapGreen dark:text-scrapGreen">
                  This is a description of the video.
                </p>
                <Link
                  className="bg-scrapBlack text-scrapRed hover:bg-scrapBlack/90 focus-visible:ring-scrapWhite dark:bg-scrapBlack dark:text-scrapRed dark:hover:bg-scrapYellow/90 dark:focus-visible:ring-scrapOrange mt-4 inline-flex h-8 items-center justify-center rounded-md px-4 text-sm font-medium shadow transition-colors focus-visible:outline-none focus-visible:ring-1 disabled:pointer-events-none disabled:opacity-50"
                  href="#"
                >
                  Watch on YouTube
                </Link>
              </div>
            </div>
            <div className="overflow-hidden rounded-lg">
              <img
                alt="YouTube Thumbnail"
                className="aspect-video object-cover"
                height={225}
                src="https://res.cloudinary.com/dpytkhyme/image/upload/v1717532637/STREETBEEFS%20SCRAPYARD/DALL_E_2024-06-04_16.23.42_-_Create_a_YouTube_video_thumbnail_for_the_streetbeefs_SCRAPYARD_channel._The_thumbnail_should_feature_a_gritty_urban_theme_with_elements_of_a_scrapyar_kyoayo.webp"
                width={400}
              />
              <div className="bg-scrapBlack dark:bg-scrapBlack p-4">
                <h3 className="text-scrapWhite text-lg font-medium">Video Title</h3>
                <p className="text-scrapWhite dark:text-scrapWhite">
                  This is a description of the video.
                </p>
                <Link
                  className="bg-scrapBlack text-scrapRed hover:bg-scrapBlack/90 focus-visible:ring-scrapOrange dark:bg-scrapBlack dark:text-scrapRed dark:hover:bg-scrapBlack/90 dark:focus-visible:ring-scrapWhite mt-4 inline-flex h-8 items-center justify-center rounded-md px-4 text-sm font-medium shadow transition-colors focus-visible:outline-none focus-visible:ring-1 disabled:pointer-events-none disabled:opacity-50"
                  href="#"
                >
                  Watch on YouTube
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
      <section className="bg-scrapBlack dark:bg-scrapBlack w-full py-12 md:py-24 lg:py-32">
        <div className="container px-4 md:px-6">
          <div className="grid gap-6 lg:grid-cols-[1fr_1fr] lg:gap-12">
            <div className="space-y-4">
              <h2 className="text-scrapYellow text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl">
                Video Game
              </h2>
              <p className="text-scrapWhite dark:text-scrapWhite max-w-[600px] md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed">
                Check out our latest video game release.
              </p>
              <Link
                className="bg-scrapBlack text-scrapBlue hover:bg-scrapBlack/90 focus-visible:ring-scrapBlack dark:bg-scrapBlack dark:text-scrapBlue dark:hover:bg-scrapBlack/90 dark:focus-visible:ring-scrapBlack/30 inline-flex h-10 items-center justify-center rounded-md px-8 text-sm font-medium shadow transition-colors focus-visible:outline-none focus-visible:ring-1 disabled:pointer-events-none disabled:opacity-50"
                href="#"
              >
                Download or Play
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <img
                alt="Game Screenshot"
                className="aspect-video rounded-lg object-cover"
                height={169}
                src="https://res.cloudinary.com/dpytkhyme/image/upload/v1717533027/STREETBEEFS%20SCRAPYARD/DALL_E_2024-06-04_16.30.19_-_Create_a_video_game_screenshot_for_a_fighting_game_inspired_by_the_STREETBEEFS_SCRAPYARD_YouTube_channel._The_scene_should_depict_an_intense_fight_in_thp5k8.webp"
                width={300}
              />
              <img
                alt="Game Screenshot"
                className="aspect-video rounded-lg object-cover"
                height={169}
                src="https://res.cloudinary.com/dpytkhyme/image/upload/v1717533027/STREETBEEFS%20SCRAPYARD/DALL_E_2024-06-04_16.30.19_-_Create_a_video_game_screenshot_for_a_fighting_game_inspired_by_the_STREETBEEFS_SCRAPYARD_YouTube_channel._The_scene_should_depict_an_intense_fight_in_thp5k8.webp"
                width={300}
              />
              <img
                alt="Game Screenshot"
                className="aspect-video rounded-lg object-cover"
                height={169}
                src="https://res.cloudinary.com/dpytkhyme/image/upload/v1717533027/STREETBEEFS%20SCRAPYARD/DALL_E_2024-06-04_16.30.19_-_Create_a_video_game_screenshot_for_a_fighting_game_inspired_by_the_STREETBEEFS_SCRAPYARD_YouTube_channel._The_scene_should_depict_an_intense_fight_in_thp5k8.webp"
                width={300}
              />
              <img
                alt="Game Screenshot"
                className="aspect-video rounded-lg object-cover"
                height={169}
                src="https://res.cloudinary.com/dpytkhyme/image/upload/v1717533027/STREETBEEFS%20SCRAPYARD/DALL_E_2024-06-04_16.30.19_-_Create_a_video_game_screenshot_for_a_fighting_game_inspired_by_the_STREETBEEFS_SCRAPYARD_YouTube_channel._The_scene_should_depict_an_intense_fight_in_thp5k8.webp"
                width={300}
              />
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
