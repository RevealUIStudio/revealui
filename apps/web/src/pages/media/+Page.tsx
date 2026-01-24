import {
	MusicBackground,
	MusicContent,
	MusicHeader,
	MusicMain,
	MusicSection,
} from "../../components/Music";

interface MusicTrack {
	id: string;
	name: string;
	title: string;
	artist: string;
	cover: string;
	audio: string;
	captions: string;
	color: string[];
	active: boolean;
}

export { Page };

function Page(): React.ReactElement {
	const music: MusicTrack[] = [
		{
			id: "1",
			name: "Street Beats",
			title: "Street Beats",
			artist: "J Gottem",
			cover:
				"https://res.cloudinary.com/dpytkhyme/image/upload/v1693437335/scrap_records_logo_sdwhr8.png",
			audio:
				"https://isrnomxlkzfngwebohyx.supabase.co/storage/v1/object/public/songs/J%20Gottem%20-%20Street%20Beats.mp3?t=2023-09-17T08%3A02%3A14.135Z",
			captions: "captions ",
			color: [],
			active: false,
		},
		{
			id: "2",
			name: "Scrapyard Anthem",
			title: "Scrapyard Anthem",
			artist: "Ronin",
			cover:
				"https://res.cloudinary.com/dpytkhyme/image/upload/v1693437335/scrap_records_logo_sdwhr8.png",

			audio:
				"https://isrnomxlkzfngwebohyx.supabase.co/storage/v1/object/public/songs/Scrapyard%20anthem(LLJG).mp3",
			captions: "captions ",
			color: [],
			active: false,
		},

		{
			id: "3",
			name: "STREETBEEFS SCRAPYARD",
			title: "STREETBEEFS SCRAPYARD",
			artist: "Chase Money feat. E.D.D.I.E. & Cadderson",
			cover:
				"https://res.cloudinary.com/dpytkhyme/image/upload/v1693437335/scrap_records_logo_sdwhr8.png",

			audio:
				"https://isrnomxlkzfngwebohyx.supabase.co/storage/v1/object/public/songs/STREETBEEFS%20SCRAPYARD.mp3",
			captions: "captions ",
			color: [],
			active: false,
		},
	];
	return (
		<MusicBackground>
			<MusicHeader />
			<MusicMain />
			<MusicContent
				songs={music.map((track) => ({
					id: track.id,
					title: track.title,
					name: track.title,
					artist: track.artist,
					cover: track.cover,
					audio: track.audio,
					captions: track.captions,
					color: [],
					active: false,
				}))}
			/>
			<MusicSection />
		</MusicBackground>
	);
}
