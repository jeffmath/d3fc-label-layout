import { rebindAll } from '@d3fc/d3fc-rebind';
import { scan } from 'd3-array';
import { collisionArea } from './util/collision';

const scanForObject = (array, comparator) => array[scan(array, comparator)];

export default (adaptedStrategy) => {

    adaptedStrategy = adaptedStrategy || ((x) => x);

    const removeOverlaps = (layout) => {
        layout = adaptedStrategy(layout);
        while (true) {
          // find the collision area for all overlapping rectangles, hiding the one
          // with the highest population rank
          const visible = layout.filter(d => !d.hidden);
          const collisions =
            visible.map((d, i) => [d, collisionArea(visible, i)])
              .filter(d => d[1] > 0);
          if (!collisions.length) break;
          const collision = scanForObject(collisions,
            (a, b) => b[0].populationRank - a[0].populationRank);
          collision[0].hidden = true;
        }
        return layout;
    };

    rebindAll(removeOverlaps, adaptedStrategy);

    return removeOverlaps;
};
