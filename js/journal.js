/**
 * Journal entries — unlocked by finding all three hidden pages in a chapter.
 * Short, historically grounded notes (about 60–90 words each).
 */
export const JOURNAL = {
  1: {
    title: 'The Burned-over District',
    place: 'Palmyra, New York · 1820',
    body:
      'Revivals swept western New York so often that it was called the “burned-over district.” Camp meetings drew great crowds, and preachers urged everyone to choose a church. Joseph’s own family was divided: his mother Lucy, his brothers Hyrum and Samuel, and his sister Sophronia joined the Presbyterians, while Joseph leaned toward the Methodists. Troubled by the strife, fourteen-year-old Joseph read James 1:5: “If any of you lack wisdom, let him ask of God.” He resolved to ask.',
  },
  2: {
    title: 'Strength Through Prayer',
    place: 'Manchester, New York · 1823',
    body:
      'On the night of September 21, 1823, Joseph prayed to know his standing before God. The angel Moroni appeared at his bedside and returned three times before dawn. Worn out the next day, Joseph collapsed while crossing a field, and Moroni came again. Prayer gave him strength to go on.',
    tip: 'In the game: when you are hurt, stand still and hold ▼ (Down) to kneel and pray. Each quiet moment of prayer restores a heart.',
  },
  3: {
    title: 'The Plates and the Translation',
    place: 'Hill Cumorah · 1827–1830',
    body:
      'On September 22, 1827, after four years of visits to the hill, Moroni entrusted Joseph with the gold plates. Neighbors schemed to take them, so the family hid them beneath a hearth and in a barrel of beans. In Harmony, Pennsylvania, Joseph translated “by the gift and power of God,” with Emma, Martin Harris, and later Oliver Cowdery as scribes. Most of the Book of Mormon was written in about three months in 1829, and it was published in March 1830.',
  },
  4: {
    title: 'Driven in Missouri',
    place: 'Jackson County, Missouri · 1833–1838',
    body:
      'From 1831 Latter-day Saints gathered to Jackson County, Missouri, hoping to build Zion. Their numbers, Northern roots, and beliefs alarmed older settlers. In 1833 mobs destroyed the church’s printing office, tarred and feathered Bishop Edward Partridge, and drove some 1,200 Saints from their homes as winter came. They resettled farther north, but conflict returned in 1838, when Governor Lilburn Boggs ordered that the Saints be “exterminated or driven from the State.”',
  },
  5: {
    title: 'Peace Be unto Thy Soul',
    place: 'Liberty Jail, Missouri · 1838–1839',
    body:
      'Through the winter of 1838–39, Joseph, his brother Hyrum, and several friends were held for more than four months in Liberty Jail, a cramped stone dungeon with a low ceiling and tiny barred windows. Cold, often ill-fed, and grieving as the Saints were driven from Missouri, Joseph pleaded, “O God, where art thou?” The answer came: “My son, peace be unto thy soul; thine adversity and thine afflictions shall be but a small moment” (D&C 121:7).',
  },
  6: {
    title: 'Nauvoo the Beautiful',
    place: 'Nauvoo, Illinois · 1839–1844',
    body:
      'Driven from Missouri, the Saints found refuge in 1839 on a swampy bend of the Mississippi River in Illinois. Joseph named the place Nauvoo, from a Hebrew word meaning beautiful. Many fell ill with malaria that first summer, and Joseph went among them blessing the sick. Within a few years Nauvoo rivaled Chicago in size, with brick homes, shops, and a temple rising on the bluff, where Joseph taught that families can be bound together forever.',
  },
  7: {
    title: 'Carthage, June 1844',
    place: 'Carthage, Illinois · 1844',
    body:
      'Facing charges after the Nauvoo city council had an opposing newspaper’s press destroyed, Joseph surrendered at Carthage under Governor Thomas Ford’s promise of protection. “I am going like a lamb to the slaughter,” he said, “but I am calm as a summer’s morning.” On June 27, as Joseph, Hyrum, John Taylor, and Willard Richards waited in the jail, a mob with painted faces stormed the building. Joseph and Hyrum were killed; John Taylor was badly wounded but survived.',
  },
};

export function wordCount(n) {
  const e = JOURNAL[n];
  return e ? e.body.split(/\s+/).filter(Boolean).length : 0;
}
