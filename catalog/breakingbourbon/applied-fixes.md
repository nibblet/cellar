# Breaking Bourbon import — what actually landed (2026-09-19)

Result: 2,110 bourbon rows (from ~480), 1,479 new drafts, 1,699 rows carrying a `source_url`,
65 drafts auto-included in the catalog (core range from makers already on the shelf), 21 soft-merged dupes.

The bulk SQL is `supabase/migrations/20260919130722_breakingbourbon_import.sql`. While applying it batch by
batch I fixed normalize.py naming slips by hand and folded BB pages that were really an existing shelf
product into that row (alias + source_url + BB facts) instead of inserting a duplicate. Those per-row
UPDATEs ran directly against the database and are listed below; the live DB is authoritative for them.

Rules that stayed in force: BB wins on non-verified rows; verified rows untouched; booleans/finish/core-range
only go up; American whiskey only (Starward, Stauning dropped when spotted); rye/malt/wheat kept as
spirit_type on the same brand family.

# Inline corrections made while applying insert batches (patch import.sql to match)
- batch 04: George Dickel Whisky Rye -> name 'George Dickel Rye', expression 'Rye'
- batch 04: Henry A. Sipes'' '' Smoked Barrel -> name 'Henry A. Sipes'' Smoked Barrel', family 'Henry A. Sipes''', expression 'Smoked Barrel'
- batch 04: High n' Wicked / High ‘N Wicked -> family 'High N'' Wicked' (flagship name 'High N'' Wicked', Warlander alias 'High ‘N Wicked Warlander')
- batch 05: Hooten Young & Jack Carr -> family 'Hooten Young', expression 'Jack Carr Warrior Proof American'
- batch 05: Jimmy Red Double Oak -> family 'Jimmy Red', expression 'Double Oak'
- batch 05: Kentucky Green Code -> family 'Kentucky Green Code', expression null
- batch 05: Knob Creek x -> name 'Knob Creek Bourbon x Rye', expression 'Bourbon x Rye'
- batch 05: JD 'Distillery Series : High Angel's Share' / 'Selection : Toasted' -> removed space before colon
- batch 05: SKIPPED inserts (same product already on shelf): Knob Creek Small Batch (-> alias on Small Batch 9 Year), Knob Creek Single Barrel (-> alias on Single Barrel Select, 9 Year), Knob Creek 18 Year LE (-> alias on 18 Year), Knob Creek 25th Anniversary (-> alias on 25th Anniversary Single Barrel), Jack Daniel's Single Barrel Select (-> updated existing 'Single Barrel' row: 94 proof, NAS, renamed)
- batch 06: 'Single Cask : ' -> 'Single Cask: ' (all Lost Lantern rows); Leopold Bros. '. Three Chamber' -> 'Three Chamber'; 'Locke' -> 'Locke + Co.'; 'KO' -> 'KO Distilling'; Liberty Pole expression drops 'Spirits '
- batch 06: Kooper variants (Koopers, Kooper's, Kooper's Family, Koopers Whiskey) -> family 'Kooper Family'; bare 'Kooper Family' rye -> 'Kooper Family Rye' (Sweetheart of the Rodeo already holds the flagship slot); SKIPPED 'Koopers Sweetheart of the Rodeo' (exists)
- batch 06: Kooper Family Rye + Koopers 10 Year Rye -> spirit_type 'rye'
- batch 07: 'Single Cask : ' -> ': '; 'United States of' -> 'United States of Bourbon'; Lux Row 'Distillers Double Barrel' -> 'Double Barrel'; Maltyverse family unified; Middle West drops 'Spirits '; 'Milam & Green' -> 'Milam & Greene'; McKenzie producer_id -> finger-lakes-distilling-co
- batch 07: SKIPPED inserts, existing rows updated instead: Lucky Seven (flagship 134.2/14yr -> renamed 'The Proprietor 14 Year'), Maker's Mark FAE-01/FAE-02 (alias+source_url), Michter's US-1 Small Batch (-> 'US*1 Bourbon', 91.4 proof), Michter's Toasted Barrel Finish Rye Whiskey (-> 'US*1 Toasted Barrel Finish Rye'), Filmland Moonlight Mayhem 115 proof (-> 'Moonlight Mayhem! Extended Cut Cask Strength')
- batch 08: 'Uncle Nearest' 84-proof row is actually Nearest Green Tennessee Whiskey -> family 'Nearest Green'; New Riff Maltster name completed ('...Made with Malted Rye'); O.K.I. '. 10 Year'/'. Reserve' -> '10 Year'/'Reserve'; O.H. Ingram family unified ('River Aged ...' expressions); 'Old Fourth Distillery:' -> no colon
- batch 08: SKIPPED inserts, existing rows updated: Nelson Brothers Blend of Straights (-> family 'Nelson Brothers', 'Reserve Bourbon'), Old Fitzgerald flagship 9yr (-> 'Bottled in Bond 9 Year Release'), Old Forester 150th Anniversary Batch (alias+source_url)
- batch 08: Old Overholt Rye (80 proof) dropped stray alias 'Old Overholt 114 Proof Rye (2020 Release)'
- batch 09: Old Stagg -> family 'Stagg', expression 'Old Stagg', spirit bourbon; Oregon Spirit / Patty Green drop 'Distillers ' from expression; Parker's Heritage expressions drop 'Collection: '
- batch 09: SKIPPED inserts, existing rows updated: Old Weller Antique (-> alias on Weller Antique 107), Penelope flagship 116.6 (-> 'Barrel Strength'), Penelope Architect (alias Build No. 3), Penelope Cooper Series (alias Riviera), Penelope Toasted 115 (alias Barrel Strength Toasted), Pinhook Bourbon War (alias War Vertical Series - 4 Year)
- batch 09: Penelope Rio (24-901)/(25-901) folded into 'Penelope Rio' as aliases; 'Phyllis Vermont' -> family 'Phyllis', expression 'Vermont Rye'
- batch 10: Purple Toad flavored rows -> family 'Purple Toad', spirit other; 'Ragged' -> 'Ragged Branch'; Rebel Yell 100 -> 'Rebel 100'; Rebel Yell Bourbon -> 'Rebel' flagship (aliases keep Rebel Yell); Romulan Stellum -> family 'Stellum', 'Romulan ...'; Rough Rider Bull Moose / Wilderness Hunter family fixed, Bull Moose spirit rye
- batch 10: SKIPPED inserts, existing rows updated: Pursuit United Blended Straight (aliases for 'Blended Bourbon' + bare 'Pursuit United'), Rebel flagship 100/10yr (-> '10 Year Single Barrel', alias Rebel Yell 10 Year SB), Redwood Empire Grizzly Beast (alias BiB, bottled_in_bond=true), Russell's Reserve 2002 Barrel Proof (aliases 1998/2002); dropped dupe 'Triple Mash Barrel Proof Rye (Batch10CF)'
- batch 10: Ranger Creek .44 (100% malted rye) -> spirit rye
- batch 11: DROPPED non-American rows that slipped the scope filter: Starward Nova, Starward Two-Fold (Australia), Stauning Floor Malted Rye (Denmark)
- batch 11: Starlight new rows drop 'Distillery ' prefix; existing Starlight rows renamed likewise; SKIPPED inserts folded into existing: Carl T. Huber's Double Oaked, Cigar Batch, Small Batch (was 'Signature Indiana Straight')
- batch 11: 'Shāng‍ East + + West' -> 'Shāng East + West'; 'Stanahan's' -> 'Stranahan's' (Diamond Peak, spirit american_single_malt); 'Star Hill Farm Whisky Wheat Whiskey' -> 'Star Hill Farm Whisky' flagship; family/expression splits fixed: Saints Alley, Seelbach's Christmas/Humidor, Sentinel, Shiner, Southern Star, Square 6, Standard Proof Whiskey Co., Stave & Barrel, Southern Cross, Shucked; producer ids filled for Sagamore High Rye, Still Austin BiB; Still Austin BiB High Rye folded into BiB as alias
- batch 12: family/expression splits fixed: Stillman's Sonder, The American Whiskey (flagship + Barrel Strength), The Bond Eternal, The Original Santa Fe Whiskey, The Wolves Rye Project Vol. One (Batch One folded as alias), Traverse City Whiskey Co., Two Souls drop 'Spirits ', TX Texas -> family TX, Unbendt Hand-filled; producer ids filled (Two Souls New York Rye, Still Austin Tanager, Unbendt)
- batch 12: SKIPPED insert, existing updated: Three Chord flagship 99 proof -> 'Strange Collaboration'
- batch 12: spirit_type fixes: Two Souls Rich Mahogany -> american_single_malt, Red Light Green Light -> other, Wisconsin Rye Shortstack -> rye; Stranahan's Colorado Whiskey -> american_single_malt
- batch 13: family/expression splits fixed: Unbendt Unblended*, Very Olde St. Nick (all variants unified; 'Very Old St. Nick Ancient Cask Immaculata' dupe dropped; O.G. 17 Year), Virginia Distillery Co. '. ', Walleye Run Malted, Warbringer, Watershed 'Distillery ', Wattie Boone & Sons, West Fork Whiskey Co., Westland 'Distillery ', Whiskey Tree High Rye; Walleye Run producer id -> new-holland-brewing-company
- batch 13: SKIPPED inserts folded into existing: Uncle Nearest 1884 Small Batch (-> 1884), WhistlePig PiggyBack Rye (-> PiggyBack 100% Rye); dropped 'Whiskey Del Bac Frontera' (kept 'Frontera Single Malt')
- batch 12/13: Unbendt producer -> Bendt Distilling Co. (slug bendt-distilling-co); batch 12 Unbendt Hand-filled needs producer_id backfill
- batch 14: 'William Heavenhill 5th'/'Edition' -> 'William Heavenhill'/'5th Edition'; Woody Creek Distillers Bourbon -> flagship (expression null); Woody Creek Macy Reserve Rye drops 'Third Edition'; 'Woodinville Port Finished' folded into 'Finished in Port Casks'
- batch 14: SKIPPED inserts folded into existing: Widow Jane 10 Year (flagship -> '10 Year'), Wilderness Trail High Rye BiB (flagship -> 'High Rye Bourbon Bottled in Bond'; two proof-less BiB dupes soft-merged via merged_into), Willett Family Estate Bottled 4 Year Rye (-> existing Family Estate Bottled Rye, facts), Woodinville 6 Year (-> flagship alias)
- batch 14: Blue Run 'Spirits Golden Rye' existing expression -> 'Golden Rye'
- batch 15: Old Charter Oak French Oak -> family 'Old Charter Oak'; TX Texas -> family 'TX' flagship; Burnside Buckman RSV split; Dread River producer id filled; 'Woodford Reserve Batch Proof' folded into Master's Collection: Batch Proof as alias
