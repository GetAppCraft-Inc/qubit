// JEE (Advanced) 2026 — Paper 2, transcribed for Qubit.
// Text uses $…$ (inline) / $$…$$ (display) LaTeX, rendered with KaTeX. `image` is a file in ./figures.
// ANSWER KEY: worked out by hand, NOT the official IIT key — verify before publishing (see VERIFY notes).
// correctAnswer: option index from 0 (A=0, B=1, C=2, D=3), comma-separated for multiple-correct; number for numeric.

const r = String.raw;

const S1 = 'Section 1 · Single correct (+3 / −1)';
const S2 = 'Section 2 · One or more correct (+4, partial, −1)';
const S3 = 'Section 3 · Numerical value (+4)';
const S4 = 'Section 4 · Paragraph, numerical (+2)';

const single = (subject, text, options, answer, extra = {}) =>
  ({ subject, section: S1, type: 'SINGLE', text, options, correctAnswer: String(answer), marks: 3, negativeMarks: 1, ...extra });
const multi = (subject, text, options, answer, extra = {}) =>
  ({ subject, section: S2, type: 'MULTIPLE', text, options, correctAnswer: answer, marks: 4, negativeMarks: 1, partialMarking: true, ...extra });
const num = (subject, text, answer, tol = 0, extra = {}) =>
  ({ subject, section: S3, type: 'NUMERIC', text, options: [], correctAnswer: String(answer), marks: 4, negativeMarks: 0, answerTolerance: tol || null, ...extra });
const para = (subject, text, answer, tol = 0, extra = {}) =>
  ({ ...num(subject, text, answer, tol, extra), section: S4, marks: 2 });

const M = 'Mathematics', P = 'Physics', C = 'Chemistry';

const SEE = (q) => [`(A) — see figure`, `(B) — see figure`, `(C) — see figure`, `(D) — see figure`].map((x) => x.replace('see figure', q));

// ───────────────────────────── MATHEMATICS ─────────────────────────────

const math = [
  single(M, r`Let $\vec a,\ \vec b$ be two vectors, and let $P, Q$ and $R$ be the points with position vectors $\vec a,\ \vec b$ and $\vec a+\vec b$, respectively, with respect to the origin $O$. If $|\vec a+\vec b|=\sqrt{21}$, $|\vec a-\vec b|=3$, and $\vec a$ and $(\vec a-\vec b)$ are perpendicular to each other, then the area of the triangle $OPR$ is`,
    [r`$\sqrt3$`, r`$\dfrac{\sqrt3}{2}$`, r`$\dfrac{3\sqrt3}{2}$`, r`$\dfrac32$`], 2),
  single(M, r`Let $T$ be the tangent to the parabola $y^2=16x$ at the point $(64, 32)$. Let $L$ be the tangent to the same parabola at another point $(x_1, y_1)$ on the parabola. If $L$ and $T$ are perpendicular to each other, then the distance between the point $(x_1, y_1)$ and the focus of the parabola is`,
    [r`$\dfrac{15}{4}$`, r`$4$`, r`$\dfrac{17}{4}$`, r`$5$`], 2),
  single(M, r`Let $y:(-\infty,\infty)\to(0,\infty)$ be the solution of the differential equation
$$\frac{dy}{dx}=\frac{e^{5x}y^3+y^3}{e^x+e^xy^4},$$
satisfying $y(0)=\dfrac{1}{\sqrt2}$. Then the value of $y(\log_e 2)$ is`,
    [r`$\sqrt{\dfrac{5+\sqrt{35}}{2}}$`, r`$\sqrt{\dfrac{7+\sqrt{53}}{2}}$`, r`$\dfrac{7+\sqrt{53}}{2}$`, r`$\dfrac{5+\sqrt{35}}{2}$`], 1),
  single(M, r`The value of the definite integral $$\int_0^2 \frac{1}{3^x+3}\,dx$$ is`,
    [r`$\dfrac12$`, r`$\dfrac13$`, r`$\dfrac{\log_e 3}{3}$`, r`$\dfrac{\log_e 3}{2}$`], 1),

  multi(M, r`Let $\mathbb R$ denote the set of all real numbers. Consider the polynomial function $f:\mathbb R\to\mathbb R$ defined by
$$f(x)=\frac{d^{10}}{dx^{10}}\left((x^2-1)^{10}\right),\quad\text{for all } x\in\mathbb R.$$
Here $\dfrac{d^{10}}{dx^{10}}\left((x^2-1)^{10}\right)$ is the $10^{\text{th}}$ order derivative of the function $(x^2-1)^{10}$.
Then which of the following statements is (are) TRUE?`,
    [r`The coefficient of $x^8$ in the polynomial $f(x)$ is $(-10)\left(\dfrac{18!}{8!}\right)$`,
     r`The value of $f(1)+f(-1)$ is equal to $10!\,2^{11}$`,
     r`The degree of the polynomial $f(x)$ is $10$`,
     r`The constant term of the polynomial $f(x)$ is $-\left(\dfrac{10!}{5!}\right)$`], '0,1,2'),
  multi(M, r`Let $a, b, c$ be positive integers in arithmetic progression such that the equation $$ax^2+bx+c=0$$ has only integer solutions.
Then which of the following statements is (are) TRUE?`,
    [r`$c-b$ is an integer multiple of $a$`, r`Both the roots of the equation $ax^2+bx+c=0$ are odd integers`,
     r`If $c=15$, then $ab=8$`, r`If $b=8$, then $x=3$ is a root of the equation $ax^2+bx+c=0$`], '0,1,2'),
  multi(M, r`Let $L$ be the straight line joining the points $P(1, 2, -1)$ and $Q(2, 3, 1)$. Let $S$ be the foot of the perpendicular drawn from the point $R(4, -1, 5)$ to the line $L$. Another line passing through $R$ intersects $L$ at a point $T$ such that the point $S$ divides the line segment $PT$ internally in the ratio $|PS| : |ST| = 1 : 2$, where $|PS|$ and $|ST|$ are the lengths of the line segments $PS$ and $ST$, respectively.
Then which of the following statements is (are) TRUE?`,
    [r`The orthocentre of the triangle $PRT$ is $\left(\dfrac{23}{5}, -4, \dfrac{31}{5}\right)$`,
     r`The orthocentre of the triangle $PRT$ is $(4, 3, 5)$`,
     r`The area of the triangle $PRT$ is $6\sqrt5$`, r`The area of the triangle $PRT$ is $18\sqrt5$`], '0,3'),
  multi(M, r`Let $y=f(x)$ be the real valued function defined on the interval $(0,\infty)$, satisfying $y(1)=0$ and the differential equation $$x\frac{dy}{dx}=y-x^3.$$
Then which of the following statements is (are) TRUE?`,
    [r`The function $f$ has a local minimum at $x=\dfrac{1}{\sqrt3}$`, r`The function $f$ has a local maximum at $x=\dfrac{1}{\sqrt3}$`,
     r`The function $f$ is increasing in the interval $(1, 2)$`,
     r`If $g(x)=4x^3-5x^2+\dfrac32x$ for $x>0$, then the number of elements in the set $\{x\in(0,\infty): f(x)=g(x)\}$ is $2$`], '1,3'),
  multi(M, r`Let $\mathbb R$ denote the set of all real numbers and let $i=\sqrt{-1}$. Consider the matrices
$$S=\begin{bmatrix}0&-1\\1&0\end{bmatrix}\quad\text{and}\quad T=\begin{bmatrix}1&1\\0&1\end{bmatrix}.$$
Let $a, b, c, d$ be real numbers such that $ST=\begin{bmatrix}a&b\\c&d\end{bmatrix}$. Let $H=\{x+iy : x, y\in\mathbb R \text{ and } y>0\}$.
Then which of the following statements is (are) TRUE?`,
    [r`$\dfrac{b+ia}{d+ic}=i$`, r`If $\omega=\dfrac{-1+i\sqrt3}{2}$, then $\dfrac{a\omega+b}{c\omega+d}=\omega$`,
     r`If $m$ is an integer greater than $2$ such that $(ST)^2=(ST)^m$, then $m$ is an integer multiple of $8$`,
     r`If $z\in H$, then $\dfrac{az+b}{cz+d}\in H$`], '1,3'),

  num(M, r`Let $\mathbb N$ denote the set of all positive integers. Consider the sets $A=\{1,2,3,4,5\}$ and $B=\{1,2,3,4,5,6,7\}$.
Let $S$ be the set of all functions $f:A\to B$ such that $f(2)\ne 2$ and $f(4)\ne 4$. Consider the set
$$T=\{f\in S : \text{there exists a function } g:B\to\mathbb N \text{ such that } g(f(x))=2^x \text{ for all } x\in A\}.$$
Then the number of elements in the set $T$ is ____.`, 1860),
  num(M, r`A bookshelf contains 6 distinct books of Mathematics and 5 distinct books of Physics. From these 11 books, 6 books are chosen at random. Let $X$ be the absolute value of the difference between the number of Mathematics books chosen and the number of Physics books chosen. If $\alpha$ is the mean of the random variable $X$, then the value of $77\alpha$ is ____.`, 100),
  num(M, r`Consider a data consisting of 10 observations $x_1, x_2, \ldots, x_{10}$, whose mean is $5$ and variance is $7$. If the mean and the variance of the first 8 observations $x_1, x_2, \ldots, x_8$ are $4$ and $3.5$, respectively, and $x_9<x_{10}$, then the value of $3x_9+2x_{10}$ is ____.`, 44),
  num(M, r`Consider the ellipse $E$ given by $\dfrac{x^2}{18}+\dfrac{y^2}{12}=1$. Let $H$ be the hyperbola whose eccentricity is the reciprocal of the eccentricity of $E$ and whose foci are the same as that of $E$. Let $P$ and $Q$ be the points of intersection of $H$ and the parabola $\sqrt5\,y=x^2$ in the first quadrant. Let $d$ be the distance between $P$ and $Q$.
If $a$ and $b$ are the integers such that $d^2=a+b\sqrt5$, then the value of $a-b$ is ____.`, 18),
  num(M, r`For a real number $\alpha$, let $[\alpha]$ denote the greatest integer less than or equal to $\alpha$. For a finite set $S$, let $|S|$ denote the number of elements in the set $S$.
Consider the functions $f:(-3,3)\to(-\infty,\infty)$ and $g:(-3,3)\to(-\infty,\infty)$ defined by
$$f(x)=[x^3]\log_e\!\left(1+\sin^2\!\left(\pi(x-[x])\right)\right)\quad\text{and}\quad g(x)=x^3\sin^2\!\left(\pi\log_e(1+x-[x])\right).$$
Let $A=\{x\in(-3,3): f \text{ is discontinuous at } x\}$ and $B=\{x\in(-3,3): g \text{ is discontinuous at } x\}$.
Then the value of $|A|+2|B|-|A\cap B|$ is ____.`, 56),

  para(M, r`**Paragraph (Q.15–16):** Consider the curve $C_1$ given by $y=e^{-x}$ for $x\in[0,10\pi]$, and the curve $C_2$ given by $y=e^{-x}(\sin x+\cos x)$ for $x\in[0,10\pi]$. Let $n$ be the total number of points of intersection of the curves $C_1$ and $C_2$. Suppose that $\alpha_1,\alpha_2,\ldots,\alpha_n\in[0,10\pi]$ are the $x$-coordinates of the points of intersection of the curves $C_1$ and $C_2$ such that $\alpha_1<\alpha_2<\cdots<\alpha_n$.

The value of $n$ is ____.`, 11),
  para(M, r`**Paragraph (Q.15–16):** Consider the curve $C_1$ given by $y=e^{-x}$ for $x\in[0,10\pi]$, and the curve $C_2$ given by $y=e^{-x}(\sin x+\cos x)$ for $x\in[0,10\pi]$. Let $\alpha_1<\alpha_2<\cdots<\alpha_n$ be the $x$-coordinates of their points of intersection.

Let $\beta$ be the area of the region enclosed between the curves $C_1$, $C_2$, and the lines $x=\alpha_1$ and $x=\alpha_4$. Then the value of $$-\frac1\pi\log_e\!\left(\beta-2e^{-\pi/2}\right)$$ is ____.`, 2.5),
  para(M, r`**Paragraph (Q.17–18):** Consider the ellipses given by $x^2+4y^2=1$ and $4x^2+y^2=1$.

Let $P$ be the point in the first quadrant where the given ellipses intersect. If $\theta$ is the acute angle between the tangents to the given ellipses at the point $P$, then the value of $4\tan\theta$ is ____.`, 7.5),
  para(M, r`**Paragraph (Q.17–18):** Consider the ellipses given by $x^2+4y^2=1$ and $4x^2+y^2=1$.

If $\alpha$ is the area of the common region that lies inside both the given ellipses, then the value of $\cot\alpha$ is ____.`, 0.75),
];

// ───────────────────────────── PHYSICS ─────────────────────────────

const physics = [
  single(P, r`A metal wire of cross-sectional area $0.5\ \text{mm}^2$ and length $100\ \text m$ is connected across a battery of e.m.f. $2\ \text V$ and internal resistance $1\ \Omega$. The density, atomic mass and electrical conductivity of the metal are $6.35\times10^3\ \text{kg m}^{-3}$, $63.5\ \text{g/mole}$ and $2\times10^8\ \text{mho m}^{-1}$, respectively. Assuming one conduction electron per atom of the metal, the drift velocity (in $\text{mm s}^{-1}$) of the electrons in the wire is:
[Take Avogadro's number as $6\times10^{23}$ and charge of the electron as $1.6\times10^{-19}\ \text C$.]`,
    ['0.052', '0.104', '0.208', '0.156'], 2),
  single(P, r`A nuclear reactor starts producing a radioactive nuclide $X$ from $t=0$, at a constant rate of $\alpha$ per second. Each decay of $X$ produces energy $E_0$, which is utilized to heat a liquid of mass $m$ and specific heat $s$. Assuming no heat loss from the liquid and taking $\lambda$ as the decay constant of $X$, the rate of increase in the temperature of the liquid is:`,
    [r`$\dfrac{\alpha E_0}{ms}\left(1-e^{-\lambda t}\right)$`, r`$\dfrac{\alpha E_0}{ms}\left(e^{\lambda t}-1\right)$`,
     r`$\dfrac{\lambda E_0}{ms}\left(1-e^{-\lambda t}\right)$`, r`$\dfrac{E_0}{ms}\left(\alpha-\lambda e^{-\lambda t}\right)$`], 0),
  single(P, r`A beam of polychromatic light passes through a thin prism of prism angle $6^\circ$. The refractive index of the material of the prism varies with wavelength $(\lambda)$ as $n(\lambda)=\alpha\lambda+\dfrac{\beta}{\lambda^2}$, where $\alpha=3\ \mu\text m^{-1}$ and $\beta=0.096\ \mu\text m^2$. If $\lambda_{\min}$ is the wavelength at which the angle of minimum deviation $D_m$ is smallest, then the correct value of $D_m$ at $\lambda_{\min}$ is`,
    [r`$6.4^\circ$`, r`$4.8^\circ$`, r`$3.2^\circ$`, r`$2.4^\circ$`], 1),
  single(P, r`A particle of mass $m$, and angular momentum $\ell$ is moving in a circular orbit of radius $r_0$ under the influence of an attractive force $\vec F(r)=-\dfrac{k}{r^2}\hat r$. Keeping its angular momentum unchanged, the particle is displaced radially by a small distance $\delta r\ll r_0$, due to which its radial distance varies periodically. The corresponding time period is:`,
    [r`$\dfrac{2\pi\ell^3}{mk^2}$`, r`$2\pi\sqrt{\dfrac mk}$`, r`$\dfrac{2\pi\ell^3}{3mk^2}$`, r`$\dfrac{2\pi\ell^3}{5mk^2}$`], 0),

  multi(P, r`Consider two isosceles prisms 1 and 2 with prism angles $A_1$ and $A_2$ and refractive indices $n_1$ and $n_2$, respectively, as shown in the figure. The faces $a_1b_1$ and $a_2b_2$ are parallel to each other and perpendicular to the mirror $M$. If a ray of light is incident on the face $a_1c_1$ and emerges from the face $a_2c_2$, then the correct statement(s) is/are:`,
    [r`If both the prisms are at minimum deviation condition, then $\dfrac{n_2}{n_1}=\sin\!\left(\dfrac{A_1}{2}\right)\Big/\sin\!\left(\dfrac{A_2}{2}\right)$.`,
     r`If prism 2 is at minimum deviation condition, then $\sin i_1=n_2\sin\!\left(\dfrac{A_2}{2}\right)$ is always true.`,
     r`If both the prisms 1 and 2 are thin and are at minimum deviation condition with angles of deviation $\delta_{m1}$ and $\delta_{m2}$, respectively, then $\theta=\dfrac{\delta_{m1}}{2(n_1-1)}+\dfrac{\delta_{m2}}{2(n_2-1)}$.`,
     r`If prism 1 is at minimum deviation condition, then $\sin i_2=n_1\sin\!\left(\dfrac{A_1}{2}\right)$ is always true.`], '0,3', { image: 'phy-q05.png' }),
  multi(P, r`In a vacuum chamber, a particle of charge $1\ \mu\text C$ and mass $1\ \text{mg}$ is projected with a velocity $(\hat\imath+2\hat\jmath)\ \text{ms}^{-1}$ from the $XZ$ plane at time $t=0$ in an electric field of $1\hat\imath\ \text{Vm}^{-1}$. At $t=0.2\ \text s$, the electric field is switched off and a magnetic field of $6\hat\jmath\ \text T$ is switched on. The acceleration due to gravity is $-10\hat\jmath\ \text{ms}^{-2}$. Correct option(s) is/are:`,
    [r`The vertical distance of the particle from the $XZ$ plane at $t=0.3\ \text s$ is $15\ \text{cm}$.`,
     r`The vertical distance of the particle from the $XZ$ plane at $t=0.4\ \text s$ is $10\ \text{cm}$.`,
     r`The radius of the trajectory of the particle for $t>0.2\ \text s$ is $20\ \text{cm}$.`,
     r`The particle will be in the $XZ$ plane at $t=0.35\ \text s$.`], '0,2'),
  multi(P, r`Two charges $Q_1=q$ and $Q_2=mq$ are placed at the points $P_1(a,b)$ and $P_2(ma,mb)$, respectively, in the $XY$ plane, where $a,b\ne0$ and $m\ne0,1$. If $V_1$ is the potential at a point in the $XY$ plane due to charge $Q_1$ and $V_2$ is the potential at that point due to charge $Q_2$. Correct statement(s) for the points at which $|V_1|=|V_2|$ is/are:`,
    [r`For $m=-1$, locus of these points is $ax+by=0$.`,
     r`For $m=2$, the locus of these points is a circle of radius $\dfrac23\sqrt{a^2+b^2}$ centered at $\left(\dfrac23a,\dfrac23b\right)$`,
     r`For $m=-2$, the locus of these points is a circle of radius $2\sqrt{a^2+b^2}$ centered at $(2a,2b)$`,
     r`For $m=-3$, locus of these points is $3bx+3ay=0$.`], '0,1,2'),
  multi(P, r`Consider an electric dipole comprising two charges $+q$ and $-q$ each with mass $m$, separated by a fixed distance $d$ and initially at rest with its dipole moment pointing along $\hat\imath$. A uniform electric field $E\hat\jmath$ is turned on at time $t=0$ and it is turned off at $t=t_f$, when the dipole moment makes an angle $\theta_f$ with $\hat\imath$. Neglecting any sources of energy loss, correct option(s) is/are:`,
    [r`The center of mass of the dipole is deflected towards $\hat\jmath$ in the presence of the field.`,
     r`If the magnitude of the final angular velocity $\omega_f=\sqrt{\dfrac{2qE}{md}}$, then $\theta_f=\dfrac\pi6$.`,
     r`If $\theta_f=\pi/3$, then the change in kinetic energy of the dipole is given by $2\sqrt3\,qEd$.`,
     r`For $\theta_f=\pi/4$, the dipole rotates around its center of mass with a constant angular velocity after $t>t_f$.`], '1,3'),
  multi(P, r`Ten moles of an ideal monoatomic gas, initially in state $\boldsymbol a$ at atmospheric pressure and temperature $T_a=27^\circ\text C$, is enclosed in a metal cylinder of volume $V_0$ fitted with a frictionless piston. The gas is suddenly compressed to state $\boldsymbol b$ with volume $V_0/3$. Now, keeping the piston stationary, the cylinder is submerged in a water bath of temperature $11^\circ\text C$ until the gas reaches the temperature of the water bath, which is denoted as state $\boldsymbol c$. Finally, while still in the water bath, the piston is brought slowly to its initial position, which is denoted as state $\boldsymbol f$. If $R$ is universal gas constant, then the correct option(s) is/are:
[Given: $9^{1/3}=2.08$]
Option (A) refers to the P–V diagram shown in the figure.`,
    [r`The schematic P–V diagram of the processes described above is the one shown in the figure.`,
     r`The change in internal energy in going from state $\boldsymbol a$ to $\boldsymbol b$ is $4860R$.`,
     r`The net change in the internal energy in the whole process is $-240R$.`,
     r`The pressure and temperature of the state $\boldsymbol b$ are $2.08$ times the atmospheric pressure and $624\ \text K$, respectively.`], '0,1,2', { image: 'phy-q09.png' }),

  num(P, r`Two thin wires, Wire-1 of diameter $0.650\ \text{mm}$ and Wire-2 of unknown diameter $d$ are given. To obtain the value of $d$, the diameters of the two wires are measured with a screw gauge. The screw gauge has a pitch of $0.5\ \text{mm}$ and there are $100$ divisions on the circular scale (CS). The smallest division on the linear scale (LS) is $0.5\ \text{mm}$. The table shows the readings of LS and CS for the measurements. The value of $d$ (in $\mu\text m$) is:
$$\begin{array}{l|c|c} & \text{LS (mm)} & \text{CS} \\ \hline \text{Wire-1} & 0.5 & 42 \\ \text{Wire-2} & 1.5 & 95 \end{array}$$`, 1915),
  num(P, r`In a single slit diffraction experiment, a slit of width $(0.016\pm0.002)\ \text{mm}$ is used to measure the wavelength of a monochromatic light source. In the diffraction pattern, the angular distance between the central maximum and first minimum is measured to be $(2^\circ\pm40')$. The value of the fractional error in the measurement of wavelength is:
[Given: $\sin(2^\circ)=0.035$]`, 0.46, 0.01),
  num(P, r`As shown in the figure, a ray $AB$ of unpolarized light enters from water of refractive index $n_w=4/3$ into a medium of refractive index $n_p=4/\sqrt3$ after passing through a glass plate of refractive index $n_g=1.5$ and a layer of water. At a particular incident angle $i$ the reflected ray $CD$ is polarized in the direction as shown in the figure. The value of $i$ (in degrees) is:`, 60, 0, { image: 'phy-q12.png' }),
  num(P, r`As shown in the figure, the resistance of a galvanometer $G$ can be found by the half-deflection method. Here the resistance $R_2$ is adjusted such that when the key $K$ is closed the deflection in the galvanometer becomes half of the value as compared to when $K$ is open. Half-deflection is obtained at $R_2=4\ \Omega$ and thus the galvanometer resistance is found to be $6\ \Omega$. In this half-deflection condition the current (in mA) through the resistor $R_1$ is:`, 694.44, 0.1, { image: 'phy-q13.png' }),
  num(P, r`In a new system of units, the units of mass, length, time and current are $5\ \text{kg}$, $5\ \text m$, $5\ \text s$ and $5\ \text A$, respectively. If $\mu_0$ and $\epsilon_0$ are the permeability and permittivity of free space, respectively, then in this new system of units, the magnitude of one SI unit of $\sqrt{\mu_0/\epsilon_0}$, is:`, 25),

  para(P, r`**Paragraph (Q.15–16):** A container of height $2\ \text m$, length $2\ \text m$ and breadth $1\ \text m$ is made of insulating vertical walls and two large area horizontal metal plates ($M_1$ and $M_2$) which extend far beyond the vertical walls in all directions. The container is partitioned into two equal chambers with a thin insulating vertical wall. The partition wall contains a small hole of cross-sectional area $\sqrt{10}\ \text{cm}^2$ near its bottom edge. Initially the hole is closed and the left chamber of the container is completely filled with a liquid of dielectric constant $\epsilon_r=15$ and the right chamber is empty ($\epsilon_r=1$). At time $t=0$, the hole is opened and the liquid flows from the left chamber to the right chamber. In both the chambers, the space above the liquid has $\epsilon_r=1$ and is maintained at atmospheric pressure. The schematic of the container at a time $t>0$ is shown in the figure. [Given: acceleration due to gravity is $10\ \text{ms}^{-2}$.]

The height (in m) of the liquid in left chamber at $t=500\ \text s$ is:`, 1.25, 0.01, { image: 'phy-q15.png' }),
  para(P, r`**Paragraph (Q.15–16):** (Same container as the previous question — see figure.) A container of height $2\ \text m$, length $2\ \text m$, breadth $1\ \text m$ between large horizontal metal plates $M_1$, $M_2$ is split into two equal chambers by a wall with a hole of area $\sqrt{10}\ \text{cm}^2$ at the bottom. At $t=0$ the left chamber is full of liquid ($\epsilon_r=15$), the right is empty, and the hole is opened. [$g=10\ \text{ms}^{-2}$]

The difference in the capacitance (in F) between the metal plates at $t=0$ and that at $t=500\ \text s$ is $(8-n)\epsilon_0$, where $\epsilon_0$ is the permittivity of free space. The value of $n$ is:`, 1.97, 0.01, { image: 'phy-q15.png' }),
  para(P, r`**Paragraph (Q.17–18):** A uniform circular disk of radius $0.2\ \text m$ and mass $1\ \text{kg}$ is pivoted at its top point $C$ such that it can rotate freely around $C$ in the $XY$ plane, as shown in the figure. Initially, when the disk is at rest, a particle of mass $20\ \text g$, travelling along negative $x$ direction in the $XY$ plane with speed $100\ \text{ms}^{-1}$, hits the circumference of the disk at a point $P$. After collision the particle moves along negative $y$ direction at a speed of $90\ \text{ms}^{-1}$. [Given: the acceleration due to gravity $(g)=-10\hat\jmath\ \text{ms}^{-2}$]

After the collision the disk starts to rotate around point $C$ in the $XY$ plane. The maximum change in the height (in m) of its center $O$ is:`, 0.15, 0.01, { image: 'phy-q17.png' }),
  para(P, r`**Paragraph (Q.17–18):** (Same disk and collision as the previous question — see figure.) A uniform disk (radius $0.2\ \text m$, mass $1\ \text{kg}$) pivoted at its top point $C$ is hit at $P$ by a $20\ \text g$ particle moving along $-x$ at $100\ \text{ms}^{-1}$; after the collision the particle moves along $-y$ at $90\ \text{ms}^{-1}$.

Amount of energy loss (in J) in the collision is:`, 17.47, 0.02, { image: 'phy-q17.png' }),
];

// ───────────────────────────── CHEMISTRY ─────────────────────────────

const chemistry = [
  single(C, r`At $300\ \text K$, the molar conductivities of the aqueous solutions of three salts at two different concentrations are given below:
$$\begin{array}{l|c|c} \text{Salt} & \text{Concentration (M)} & \text{Molar conductivity (S cm}^2\text{ mol}^{-1}) \\ \hline \text{NaNO}_3 & 0.01 & 111 \\ & 0.04 & 101 \\ \hline \text{NaCl} & 0.01 & 117 \\ & 0.04 & 107 \\ \hline \text{AgNO}_3 & 0.01 & 125 \\ & 0.04 & 116 \end{array}$$
The conductivity of a saturated aqueous solution of AgCl is $1.40\times10^{-6}\ \text{S cm}^{-1}$ at $300\ \text K$. If the solubility of AgCl in water at $300\ \text K$ is $X\ \text{mol L}^{-1}$, then $\log_{10}(X^{-1})$ is
(Assume that AgCl dissolved in water ionizes completely and that the molar conductivity of saturated AgCl solution is equal to its limiting molar conductivity.)`,
    ['3', '4', '5', '6'], 2),
  single(C, r`The correct order of ONO bond angle in the given species is`,
    [r`$\text{NO}_2^+<\text{NO}_2<\text{NO}_3^-<\text{NO}_2^-$`, r`$\text{NO}_2^-<\text{NO}_3^-<\text{NO}_2<\text{NO}_2^+$`,
     r`$\text{NO}_3^-<\text{NO}_2^-<\text{NO}_2<\text{NO}_2^+$`, r`$\text{NO}_2^-<\text{NO}_3^-<\text{NO}_2^+<\text{NO}_2$`], 1),
  single(C, r`Natural rubber on complete ozonolysis ($\text O_3/\text{Zn-H}_2\text O$) gives compound **X** as the major product. **X** gives positive iodoform and Tollen's tests. **X** on heating with aqueous NaOH gives **Y** as the major product. **Y** is (structures in the figure)`,
    SEE('structure in the figure'), 0, { image: 'che-q03.png' }),
  single(C, r`A known artificial sweetener **X** is composed of 4-chloro-4-deoxy-α-D-galactose and 1,6-dichloro-1,6-dideoxy-β-D-fructose joined by a glycosidic linkage. The structure of D-galactose and the four candidate structures are given in the figure. The correct structure of **X** is`,
    SEE('structure in the figure'), 0, { image: 'che-q04.png' }),

  multi(C, r`For a first-order reaction $\textbf R\longrightarrow\textbf P$ at a given temperature, $k$ is the rate constant. For this reaction, at the given temperature, the concentrations of **R** and **P** at a time $t$ are $[\textbf R]$ and $[\textbf P]$, respectively. The correct graphical representation(s) for this reaction is(are) (graphs in the figure)`,
    [r`Graph (A): $[\textbf P]$ vs $t$`, r`Graph (B): $\dfrac{d[\textbf R]}{dt}$ vs $[\textbf R]$`, r`Graph (C): $\dfrac{d[\textbf P]}{dt}$ vs $t$`, r`Graph (D): $k$ vs $t$`], '2,3', { image: 'che-q05.png' }),
  multi(C, r`Correct statement(s) about the compounds **P**, **Q** and **R** is(are)
$$\text{Xe(g)}+\text F_2\text{(g)}\ (1:5\ \text{ratio})\xrightarrow{873\ \text K,\ 7\ \text{bar}}\textbf P$$
$$\textbf P+\text O_2\text F_2\xrightarrow{143\ \text K}\textbf Q+\text O_2$$
$$\textbf Q+\text H_2\text O\xrightarrow{\text{complete hydrolysis}}\textbf R+\text{HF}$$`,
    [r`**P** has two lone pairs of electrons on the central atom.`, r`**Q** has a perfect octahedral geometry.`,
     r`**Q** can act as a fluorinating agent.`, r`The molecular structure of **R** is trigonal pyramidal.`], '0,2,3'),
  multi(C, r`The correct statement(s) regarding the periodic properties of elements is(are)`,
    [r`Second ionization enthalpy of carbon atom is less than that of boron atom.`, r`Increasing order of ionic radii: $\text{Al}^{3+}<\text{Mg}^{2+}<\text{Na}^+$`,
     r`Under identical conditions, in solid state, the density of potassium metal is more than density of sodium metal.`, r`The H–H bond is weaker than F–F bond.`], '0,1'),
  multi(C, r`In the reaction sequence shown in the figure, **P**, **Q**, **S** and **T** are the major products:
aniline $\xrightarrow{1.\ (\text{CH}_3\text{CO})_2\text O,\ \text{pyridine};\ 2.\ \text{conc. HNO}_3,\ \text{conc. H}_2\text{SO}_4,\ 288\ \text K}$ **P** $\xrightarrow{1.\ \text H_3\text O^+;\ 2.\ \text{NaNO}_2/\text{HCl},\ 273\text{–}278\ \text K}$ **Q**
cumene $\xrightarrow{1.\ \text O_2/\text H_3\text O^+;\ 2.\ \text{NaOH/CO}_2;\ 3.\ \text H_3\text O^+}$ **S** $\xrightarrow{\textbf Q,\ \text{aqueous NaOH}}$ **T**
The correct statement(s) about **P**, **Q**, **S** and **T** is(are)`,
    [r`**Q** on treatment with ethanol generates an aromatic aldehyde.`, r`**S** gives positive phthalein dye test.`,
     r`**P** is a dinitro compound.`, r`**T** is a coloured compound.`], '1,3', { image: 'che-q08.png' }),
  multi(C, r`The correct statement(s) regarding sugars is(are)
**Given:** Specific rotations of L-(−)-glucose and L-(+)-fructose are $-52.5^\circ$ and $+92.5^\circ$, respectively.`,
    [r`On treatment with $\text{HNO}_3$, gluconic acid is oxidized to saccharic acid, whereas glucose is not oxidized to saccharic acid.`,
     r`Fructose gives a positive Fehling's test because it isomerises to glucose and another aldohexose in the presence of Fehling's reagent.`,
     r`Invert sugar is an equimolar mixture of D-glucose and D-fructose formed after hydrolysis of the corresponding disaccharide.`,
     r`Specific rotation of invert sugar is $-40^\circ$.`], '1,2'),

  num(C, r`$\text X^{a+}$ and $\text Y^{b+}$ are hydrogen-like species. The wavelength of light absorbed during the transition between the states with principal quantum numbers $n=1$ and $n=2$ of $\text X^{a+}$ is $\lambda$. The wavelength of light absorbed during the transition between the states with principal quantum numbers $n=2$ and $n=4$ of $\text Y^{b+}$ is $9\lambda$. The lowest possible value of $(a+b)$ is ____.`, 3),
  num(C, r`At a given temperature, $0.45\ \text g$ of acetic acid in $50\ \text{mL}$ of water is shaken with $1.0\ \text g$ of charcoal and the pH of the resulting solution is $3.0$. Assume, the adsorption of acetic acid from the aqueous solution by charcoal follows Freundlich isotherm, $$\frac xm=kC^{1/n}$$
If the plot of $\log_{10}(x/m)$ against $\log_{10}C$ gives a straight line with slope 1, the value of $k$ in $\text{L mol}^{-1}$ is ____.
**Given:** The molar mass of acetic acid is $60\ \text{g mol}^{-1}$. The acid dissociation constant of acetic acid is $1.0\times10^{-5}$ at the given temperature. $x$ is the mass (in grams) of acetic acid adsorbed. $m$ is the mass (in grams) of charcoal. $C$ is the equilibrium concentration of acetic acid in the solution after the adsorption is complete. $k$ and $n$ are constants for acetic acid–charcoal system at the given temperature.`, 1.5, 0.05),
  num(C, r`In a solvent **S**, a compound **B** is partially dissociated into **C** and **D** as given below: $$\textbf B\rightleftharpoons 2\textbf C+2\textbf D$$
**B**, **C** and **D** are non-volatile in nature. The molar mass of **B** is 10 times the molar mass of **S**. The standard boiling point and the standard enthalpy of vaporization of **S** are $400\ \text K$ and $10R\ \text{J mol}^{-1}$, respectively ($R$ is the gas constant in $\text{J K}^{-1}\text{mol}^{-1}$). A solution of **B** in **S** with an initial concentration of **B** as $0.25\%$ (mass/mass) has a boiling point of $408\ \text K$ at $1\ \text{bar}$ pressure. In this solution, the mole percent of **B** that has been dissociated is ____.`, 33.25, 0.1),
  num(C, r`Consider that the coordinating atoms of the ligands in $\textit{cis}$-$[\text{Co(NH}_3)_4\text{Cl}_2]\text{Cl}$ and $\textit{mer}$-$[\text{Co(NH}_3)_3\text{Cl}_3]$ octahedral complexes are at the vertices of an octahedron. The sum of total number of the triangular faces in both the complexes having one N atom and two Cl atoms at their corners is ____.`, 6),
  num(C, r`In the following reaction sequence, major products **X** and **Y** are acyclic monomers.
$$\text{CH}_3\text I\xrightarrow{1.\ \text{KCN};\ 2.\ \text H_3\text O^+,\ \Delta;\ 3.\ \text{Red P, Br}_2;\ 4.\ \text{NH}_3\ (\text{excess})}\textbf X\qquad\text{Caprolactam}\xrightarrow{\text H_3\text O^+,\ \Delta}\textbf Y$$
500 mol of **X** completely reacts with 500 mol of **Y** to give 1 mol of a single biodegradable acyclic copolymer **Z** as the only product. The amount of **Z** formed in grams is ____.
**Given:** Atomic mass (in amu): H : 1, C : 12, N : 14, O : 16, Br : 80`, 85018),

  para(C, r`**Paragraph (Q.15–16):** Two volatile liquids **A** and **B** form an ideal solution. Consider a 5 molal solution of **B** in **A** inside a closed container having a total vapour pressure of $100\ \text{mm Hg}$ at $300\ \text K$. The vapour pressure of pure **A** at $300\ \text K$ is $105\ \text{mm Hg}$. Assume that **A** and **B** behave as ideal gases in the vapour phase.
**Given:** $R=0.08\ \text{L atm K}^{-1}\text{mol}^{-1}$; molar mass of **A** is $50\ \text{g mol}^{-1}$; molar mass of **B** is $57\ \text{g mol}^{-1}$; density of liquid **B** at $300\ \text K$ is $0.5\ \text{g/mL}$; $1\ \text{atm}=760\ \text{mm Hg}$.

At $300\ \text K$, the ratio of the molar volume of pure **B** in vapour phase to its molar volume in liquid phase is ____.`, 2000),
  para(C, r`**Paragraph (Q.15–16):** Two volatile liquids **A** and **B** form an ideal solution. A 5 molal solution of **B** in **A** in a closed container has a total vapour pressure of $100\ \text{mm Hg}$ at $300\ \text K$; the vapour pressure of pure **A** at $300\ \text K$ is $105\ \text{mm Hg}$. (Molar mass of **A** $=50$, of **B** $=57\ \text{g mol}^{-1}$.)

The mole fraction of **B** in vapour phase which is in equilibrium with this solution is ____.`, 0.16),
  para(C, r`**Paragraph (Q.17–18):** Consider the reaction sequence in the figure, in which **J**, **K**, **L** and **M** are the major products (**K** has molar mass $350\ \text{g/mol}$; **L** is formed with excess $\text{NH}_3$, **M** with PhSNa).
**Given:** Atomic mass (in amu): H : 1, C : 12, N : 14, O : 16, S : 32, Br : 80, Ba : 137

The volume of 1 M aqueous $\text H_2\text{SO}_4$ required to completely neutralize the ammonia evolved from $5.72\ \text g$ of **L** in Kjeldahl's method of nitrogen estimation is ____ mL.`, 10, 0, { image: 'che-q17.png' }),
  para(C, r`**Paragraph (Q.17–18):** Consider the reaction sequence in the figure, in which **J**, **K**, **L** and **M** are the major products (**K** has molar mass $350\ \text{g/mol}$; **M** is formed from **K** with PhSNa).
**Given:** Atomic mass (in amu): H : 1, C : 12, N : 14, O : 16, S : 32, Br : 80, Ba : 137

In sulphur estimation by Carius method, the amount of $\text{BaSO}_4$ formed from $3.79\ \text g$ of **M** is ____ g.`, 2.33, 0.01, { image: 'che-q17.png' }),
];

export const exam = {
  code: 'JEEA-2026-P2',
  title: 'JEE (Advanced) 2026 · Paper 2',
  category: 'JEE_ADVANCED',
  mode: 'PROCTORED',
  durationMinutes: 180,
  lateEntryMinutes: 15,
  violationTolerance: 0,
  showResults: true,
  description: 'Full Paper 2 of JEE (Advanced) 2026 — Mathematics, Physics and Chemistry, 18 questions each, 180 marks.',
  instructions: [
    'This paper has three subjects: Mathematics, Physics and Chemistry. Each has four sections.',
    'Section 1 — 4 single-correct questions: +3 if correct, 0 if unanswered, −1 otherwise.',
    'Section 2 — 5 one-or-more-correct questions: +4 for all correct options; +3/+2/+1 when only correct options are chosen but not all; 0 if unanswered; −1 otherwise.',
    'Section 3 — 5 numerical-value questions: +4 if correct, 0 otherwise. Enter values truncated/rounded to two decimal places.',
    'Section 4 — 2 paragraphs with 2 numerical questions each: +2 if correct, 0 otherwise.',
    'Maximum marks: 180 (60 per subject).',
  ].join('\n'),
};

export const questions = [...math, ...physics, ...chemistry];

// Items worth a second look against the official key.
export const verify = [
  'Chemistry Q8 (B): whether salicylic acid is accepted as giving a positive phthalein dye test (key: B, D).',
  'Chemistry Q11: k = 1.5 if C ≈ x²/Ka = 0.1 M (accepting 1.45–1.55).',
  'Chemistry Q12: 33.17 (exact solvent mass) vs 33.33 (dilute approx.) — accepting 33.15–33.35.',
  'Physics Q11: 0.46 (accepting 0.45–0.47).',
  'Physics Q5: (C) rejected because θ = A₁ + A₂ (no factor of 2).',
];
