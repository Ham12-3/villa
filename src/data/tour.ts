/**
 * The walkthrough that follows the main story (story units 100 onwards).
 *
 * Unlike the orbiting model views, this is a path of eye points and look-at
 * points, in metres, that a person could actually walk: in over the pool and
 * through one bay of the living-room glazing, then room to room through the
 * real door openings, up the stair to the first floor, out through the
 * bedroom glazing onto the terrace, down over the pool, through an arch into
 * the loggia lounge and out into the garden, ending with a look back at the
 * house from the lawn.
 *
 * Waypoints either side of every doorway differ along one axis only, so the
 * camera crosses each opening in a straight line through its centre.
 */

type V3 = [number, number, number];

export interface TourKey {
  /** story position */
  at: number;
  eye: V3;
  look: V3;
  /** vertical field of view, degrees */
  fov: number;
}

const k = (at: number, eye: V3, look: V3, fov: number): TourKey => ({ at, eye, look, fov });

/** standing eye height */
const E = 1.65;
/** eye height on the first floor (slab at +4.000) */
const E1 = 4 + 1.62;

export const TOUR_START = 100;

/** Keys after the hand-over from the model view (whose pose at 100 is prepended at run time). */
export const tourKeys: TourKey[] = [
  // ---- arrive: swing to the garden axis, between the olives, low over the pool
  k(106, [-23.1, 11.0, 58.2], [0, 4.5, 1], 30),
  k(111.5, [-1.5, 4.1, 24.6], [3, 3, -1], 34),
  k(116, [1.8, 2.84, 10.95], [3, 2.6, -2.5], 40),
  k(120, [3.0, 2.45, 2.07], [2.4, 2.5, -3.5], 48), // at the glass, between two mullions

  // ---- living room
  k(125, [3.46, 1.87, -0.44], [-3.2, 2.7, -4.6], 58),
  k(129, [5.4, E, -1.6], [5.6, 1.6, -5.4], 58),

  // ---- lobby: in through the double doors (x 6), look round, and back out
  k(131.5, [6, E, -4.3], [6, 1.5, -9.5], 58),
  k(135, [6, E, -6.5], [6.7, 1.45, -10.6], 60),
  k(138, [6, E, -4.3], [2, 1.5, -1], 58),

  // ---- across the living room along the glazing, into the dining room
  k(141, [4.2, E, 0.55], [-4, 1.5, 0.2], 56),
  k(144, [-2.4, E, 0.55], [-9, 1.3, -1.2], 56),
  k(146, [-4.8, E, -0.9], [-11, 1.2, -1.4], 56),
  k(149, [-7.4, E, -0.9], [-12.6, 1.0, -1.4], 58),

  // ---- kitchen: round the end of the table, through the door at x -9
  k(152, [-9, E, -3.7], [-9.6, 1.4, -8], 58),
  k(154.5, [-9, E, -6.5], [-12.6, 1.1, -10.6], 60),
  k(158, [-8.5, E, -7.2], [-14.2, 1.0, -11.2], 60),

  // ---- stair hall and up the flight to the gallery
  k(160.5, [-7.1, E, -7.3], [-2, 2.0, -7.8], 58),
  k(162, [-5.75, 1.7, -7.45], [-1, 3.0, -8], 58),
  k(163.5, [-5.0, 1.8, -8], [0, 4.2, -8], 58),
  k(169.5, [0.9, 5.72, -8], [5, 5.3, -7], 58),
  k(173, [3.6, E1, -6.9], [8, 4.2, -2.2], 60), // over the living-room void
  k(177, [10.6, E1, -7.3], [15, 5.3, -7.6], 58),

  // ---- bathroom, then through to the bedroom
  k(179, [13.3, E1, -7.3], [19, 5.0, -9.4], 58),
  k(183, [14.5, E1, -8.0], [20.6, 4.7, -9.8], 60),
  k(186, [13.6, E1, -6.9], [15.5, 5.2, -5.6], 58),
  k(188.5, [13.6, E1, -4.3], [17.2, 4.9, -4.4], 58),
  k(193, [14.5, E1, -1.1], [17.6, 4.8, -4.3], 60),

  // ---- out through the glazing, over the terrace rail, down to the pool
  k(197, [18, E1, -0.8], [18, 5.0, 9], 56),
  k(200, [18, 5.9, 3.5], [11, 2.0, 11], 54),
  k(204, [16.6, 6.5, 7.6], [7, 0.4, 11.4], 52),
  k(209.5, [9, 1.5, 11.4], [-5.5, 1.9, 7.4], 50),

  // ---- along the terrace and through the middle arch into the lounge
  k(214, [-3.2, E, 7.4], [-12, 1.3, 7.2], 54),
  k(216.5, [-7.3, E, 7.0], [-14, 1.2, 7.6], 58),
  k(221, [-8.4, E, 6.9], [-15.6, 1.0, 6.4], 60),

  // ---- out through the garden arch, across the lawn, and turn to face the house
  k(225, [-13, E, 10.6], [-13.4, 1.7, 20], 56),
  // (along the stepping-stone path, then backing away down the lawn between two olives)
  k(228, [-13, 1.7, 14.6], [-9, 2.2, 18.5], 54),
  k(231, [-9.5, 1.7, 17.6], [-1, 2.6, 15], 54),
  k(234.5, [-1.5, 1.9, 19.6], [1, 4.2, 6], 54),
  k(238, [-1.5, 2.3, 26.2], [1, 5.2, 0], 56),
];

export const TOUR_END = 238;

/** Story positions between which the facade glazing is cleared for the camera to pass. */
export const glassClear = { out: [113.5, 118.5], back: [229, 234] } as const;
