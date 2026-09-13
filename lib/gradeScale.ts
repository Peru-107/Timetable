// Grade points are printed verbatim on the NMIMS (SVKM) absolute-grading
// marksheet: A+:4, A:3.75, A-:3.5, B+:3.25, B:3, B-:2.75, C+:2.5, C:2.25,
// C-:2, D:1.5, F:0.
//
// Percentage bands from A+ down to C+ (minPercent 61 and above) were
// reverse-engineered from a real transcript's Final Marks/Final Grade
// pairs and confirmed exact: recomputing that transcript's GPA
// (credit-weighted average of these grade points) reproduces its stated
// GPA of 3.23 precisely.
//
// Bands below C+ (marked UNVERIFIED) are a placeholder guess only - no
// real data point falls in that range, and the point *gaps* get uneven
// right there (C- -> D drops 0.5 instead of the steady 0.25 step above
// it, D -> F drops 1.5), which is a strong signal those bands aren't the
// same uniform 4-point width as the verified ones. Don't trust the D/F
// cutoff for a real pass/fail decision until it's checked against the
// institute's actual grading circular - this only needs the two numbers
// below updated once confirmed.
export interface GradeBand {
  letter: string;
  point: number;
  minPercent: number; // inclusive lower bound
}

export const GRADE_BANDS: GradeBand[] = [
  { letter: "A+", point: 4.0, minPercent: 85 },
  { letter: "A", point: 3.75, minPercent: 81 },
  { letter: "A-", point: 3.5, minPercent: 77 },
  { letter: "B+", point: 3.25, minPercent: 73 },
  { letter: "B", point: 3.0, minPercent: 69 },
  { letter: "B-", point: 2.75, minPercent: 65 },
  { letter: "C+", point: 2.5, minPercent: 61 },
  // ---- unverified below this line ----
  { letter: "C", point: 2.25, minPercent: 57 },
  { letter: "C-", point: 2.0, minPercent: 53 },
  { letter: "D", point: 1.5, minPercent: 45 },
  { letter: "F", point: 0.0, minPercent: 0 },
];

export function percentageToGrade(percentage: number): GradeBand {
  for (const band of GRADE_BANDS) {
    if (percentage >= band.minPercent) return band;
  }
  return GRADE_BANDS[GRADE_BANDS.length - 1];
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export interface ComputedGrade {
  percentage: number;
  letterGrade: string;
  gradePoint: number;
}

export function computeGradeFromMarks(
  icaMarks: number,
  icaMax: number,
  teeMarks: number,
  teeMax: number
): ComputedGrade {
  const totalMarks = icaMarks + teeMarks;
  const totalMax = icaMax + teeMax;
  const percentage = totalMax > 0 ? (totalMarks / totalMax) * 100 : 0;
  const band = percentageToGrade(percentage);
  return {
    percentage: round2(percentage),
    letterGrade: band.letter,
    gradePoint: band.point,
  };
}
