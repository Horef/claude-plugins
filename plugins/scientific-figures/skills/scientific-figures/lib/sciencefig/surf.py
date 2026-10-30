"""3D surfaces and 3D axes on a Canvas (orthographic projection, painter's
algorithm). For loss landscapes, energy surfaces, 2D Gaussians, tuning
surfaces - when the SHAPE of z(x, y) is the message.

Prefer a 2D heatmap/contour plot when values must be read off (Wilke
ch. 26: 3D hides values and distorts). Use 3D when the shape itself is the
point (plateaus vs slopes, valleys, saddles) and add a contour view if
numbers matter.

    from sciencefig import surf as Sf
    v = Sf.View3D(c, cx=160, cy=300, size=120, xlim=(-3, 3), ylim=(-3, 3),
                  zlim=(0, 1), elev=28, azim=-55)
    v.surface(X, Y, Z)                      # X, Y, Z: 2D arrays (meshgrid)
    v.axes(labels=("$w_1$", "$w_2$", "loss"))
"""
import math

import numpy as np

from . import style as S


def _cmap(name):
    import matplotlib
    return matplotlib.colormaps[name]


def _rgb(c):
    return "rgb({},{},{})".format(*(int(round(255 * v)) for v in c[:3]))


class View3D:
    def __init__(self, c, cx, cy, size, xlim, ylim, zlim, elev=28, azim=-55, zheight=0.75):
        """size: half-width (px) of the unit cube's footprint; zheight: height
        of the z range relative to the x/y half-extent."""
        self.c, self.cx, self.cy, self.size = c, cx, cy, size
        self.xlim, self.ylim, self.zlim = xlim, ylim, zlim
        self.e, self.a = math.radians(elev), math.radians(azim)
        self.zh = zheight

    def _norm(self, x, y, z):
        nx = 2 * (np.asarray(x) - self.xlim[0]) / (self.xlim[1] - self.xlim[0]) - 1
        ny = 2 * (np.asarray(y) - self.ylim[0]) / (self.ylim[1] - self.ylim[0]) - 1
        nz = self.zh * (2 * (np.asarray(z) - self.zlim[0]) / (self.zlim[1] - self.zlim[0]) - 1)
        return nx, ny, nz

    def project(self, x, y, z):
        """Data -> (screen x, screen y, depth). Larger depth = farther away."""
        nx, ny, nz = self._norm(x, y, z)
        ca, sa = math.cos(self.a), math.sin(self.a)
        u = nx * ca - ny * sa
        v = nx * sa + ny * ca
        up = nz * math.cos(self.e) + v * math.sin(self.e)
        depth = v * math.cos(self.e) - nz * math.sin(self.e)
        return self.cx + self.size * u, self.cy - self.size * up, depth

    def P(self, x, y, z):
        sx, sy, _ = self.project(x, y, z)
        return float(sx), float(sy)

    def surface(self, X, Y, Z, cmap=S.CMAP_PERCEPTUAL, light=(-0.4, -0.6, 1.0), shade=0.35,
                mesh="#ffffff", mesh_opacity=0.45, mesh_width=0.5, clim=None):
        """Filled quads coloured by z (sequential colormap) with Lambert
        shading so the shape reads, plus a light mesh. Grid ~30x30 keeps
        the SVG near 60 kB."""
        X, Y, Z = map(np.asarray, (X, Y, Z))
        sx, sy, dp = self.project(X, Y, Z)
        nx, ny, nz = self._norm(X, Y, Z)
        cm = _cmap(cmap)
        lo, hi = clim or (self.zlim[0], self.zlim[1])
        L = np.array(light, float); L /= np.linalg.norm(L)
        quads = []
        R, C = Z.shape
        for i in range(R - 1):
            for j in range(C - 1):
                idx = [(i, j), (i, j + 1), (i + 1, j + 1), (i + 1, j)]
                d = np.mean([dp[k] for k in idx])
                # normal from the two diagonals (normalised coordinates)
                p = [np.array([nx[k], ny[k], nz[k]]) for k in idx]
                n = np.cross(p[2] - p[0], p[3] - p[1])
                nn = np.linalg.norm(n)
                lam = abs(float(n @ L) / nn) if nn > 0 else 1.0
                zm = float(np.mean([Z[k] for k in idx]))
                col = np.array(cm(min(1, max(0, (zm - lo) / (hi - lo))))[:3])
                col = col * (1 - shade + shade * lam)
                quads.append((d, [(sx[k], sy[k]) for k in idx], _rgb(col)))
        quads.sort(key=lambda q: -q[0])
        from .svg import _fmt
        body = []
        for _, pts, col in quads:
            d = "M" + "L".join(f"{round(x)} {round(y)}" for x, y in pts) + "Z"
            body.append(f'<path d="{d}" fill="{col}"/>')
        # shared stroke on a group keeps the SVG small (~45 bytes per quad)
        self.c.items.append(f'<g stroke="{mesh}" stroke-opacity="{mesh_opacity}" '
                            f'stroke-width="{mesh_width}" stroke-linejoin="round">'
                            + "".join(body) + "</g>")
        # register the outline for lint (labels must not sit on the surface)
        edge = ([(sx[0, j], sy[0, j]) for j in range(C)] + [(sx[i, -1], sy[i, -1]) for i in range(R)]
                + [(sx[-1, j], sy[-1, j]) for j in range(C - 1, -1, -1)]
                + [(sx[i, 0], sy[i, 0]) for i in range(R - 1, -1, -1)])
        self.c._geom([(float(a), float(b)) for a, b in edge], "surface", True)
        return quads

    def box_floor(self, color=S.GRID, width=1.0):
        """Outline of the floor (z = zlim[0]) - a quiet frame for the surface."""
        x0, x1 = self.xlim; y0, y1 = self.ylim; z = self.zlim[0]
        pts = [self.P(x0, y0, z), self.P(x1, y0, z), self.P(x1, y1, z), self.P(x0, y1, z),
               self.P(x0, y0, z)]
        self.c.polyline(pts, color=color, width=width, tag="floor", lint=False)

    def axes(self, labels=("x", "y", "z"), color=S.AXIS, size=S.SIZE_SMALL, as_math=False,
             pad=10, extend=0.12):
        """Draw BEFORE surface(): the two floor axes run along the front floor
        edges from the corner nearest the viewer (so the surface sits on
        them), the z axis stands at the leftmost floor corner. Labels go
        beyond the arrow tips."""
        x0, x1 = self.xlim; y0, y1 = self.ylim; z0, z1 = self.zlim
        corners = {(x, y): self.P(x, y, z0) for x in (x0, x1) for y in (y0, y1)}
        near = max(corners, key=lambda k: corners[k][1])
        o = corners[near]
        adj_x = ((x1 if near[0] == x0 else x0), near[1])   # along x
        adj_y = (near[0], (y1 if near[1] == y0 else y0))   # along y
        left = min(corners, key=lambda k: corners[k][0])
        zb, zt = self.P(left[0], left[1], z0), self.P(left[0], left[1], z1)
        segs = [(o, corners[adj_x]), (o, corners[adj_y]), (zb, zt)]
        out = []
        for (p, q), lab in zip(segs, labels):
            ex = (q[0] + extend * (q[0] - p[0]), q[1] + extend * (q[1] - p[1]))
            self.c.arrow(p[0], p[1], ex[0], ex[1], color=color, width=1.0, head="tri",
                         head_size=7, tag="axis3d", lint=False)
            ang = math.atan2(ex[1] - p[1], ex[0] - p[0])
            lx, ly = ex[0] + pad * math.cos(ang), ex[1] + pad * math.sin(ang)
            anchor = "middle" if abs(math.cos(ang)) < 0.4 else ("start" if math.cos(ang) > 0 else "end")
            bl = "alphabetic" if math.sin(ang) < -0.9 else "middle"
            if as_math:
                self.c.math(lx, ly, lab, size=size + 3, anchor=anchor, baseline=bl)
            else:
                self.c.text(lx, ly, lab, size=size, anchor=anchor, baseline=bl, color=S.INK2)
            out.append(ex)
        return out
