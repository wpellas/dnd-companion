import type { Msg } from './types'

/** The time and light panel on the Party page, and its setting. */
export const time = {
  'time.title': ['Light and time', 'Ljus och tid'],
  'time.track': ['Track time and light in this campaign', 'Håll reda på tid och ljus i den här kampanjen'],
  'time.trackTitle': ['Off: the "Light and time" panel is not shown on the Party page. The day counter for rests keeps working.', 'Av: panelen "Ljus och tid" visas inte på Sällskap-sidan. Dagräknaren för vilor fortsätter fungera.'],
  'time.summary': ['Day {day} · {time} ({period})', 'Dag {day} · {time} ({period})'],
  'time.dawn': ['dawn', 'gryning'],
  'time.day': ['day', 'dag'],
  'time.dusk': ['dusk', 'skymning'],
  'time.night': ['night', 'natt'],
  'time.min': ['min', 'min'],
  'time.hour': ['hour', 'timme'],
  'time.hours': ['hours', 'timmar'],
  'time.toDawn': ['To dawn', 'Till gryningen'],
  'time.dawnTitle': ['Moves the clock to 06:00 (the next day if it is already past)', 'Flyttar klockan till 06:00 (nästa dag om det redan passerat)'],
  'time.set': ['Set the time', 'Ställ tiden'],
  'time.lights': ['Light sources', 'Ljuskällor'],
  'time.noLights': ['Nothing is burning.', 'Inget brinner.'],
  'time.lit': ['lit', 'tänd'],
  'time.light': ['Light it', 'Tänd'],
  'time.radius': ['bright {bright}, dim {dim}', 'starkt {bright}, svagt {dim}'],
  'time.hoursLeft': ['{h} h {m} min left', '{h} h {m} min kvar'],
  'time.minLeft': ['{m} min left', '{m} min kvar'],
  'time.burnedOut': ['burned out', 'utbrunnen'],
  'time.note': ['A lit light burns down as time passes (a torch lasts 1 hour, a lamp or lantern a flask of oil, 6 hours). Players do not see this panel.', 'En tänd ljuskälla brinner ner när tiden går (en fackla räcker 1 timme, en lampa eller lykta en oljeflaska, 6 timmar). Spelarna ser inte den här panelen.'],
} as const satisfies Record<string, Msg>
