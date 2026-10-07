import {GUIDE,COMMON} from './trend-2027-guide.mjs';
import {weekDraft} from './trend-2027-weeks.mjs';
const PRESET_ID='nal-read-01-trend-2027-v1';
// Call ONLY after the existing SQL studio role+season check succeeds.
// This is a finite authoring library, not a filesystem path or dynamic remote import.
export function firstSeasonPreset(presetId,weekNumber){
 if(presetId!==PRESET_ID||!Number.isInteger(weekNumber)||weekNumber<1||weekNumber>4){
  const error=new Error('Unknown editorial preset');error.code='22023';throw error;
 }
 return structuredClone({
  id:PRESET_ID,version:1,reviewStatus:'draft',title:COMMON.title,
  intendedSeason:'trend-2027',importBehavior:'editor-only; separate save and publication required',
  common:COMMON,guide:GUIDE,
  outline:[1,2,3,4].map(number=>{const w=weekDraft(number);return {number,code:w.code,title:w.title,minutes:w.minutes,dayRange:w.dayRange,participantOutput:w.participantOutput};}),
  week:weekDraft(weekNumber)
 });
}
