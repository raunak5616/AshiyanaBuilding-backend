import { BaseRepository } from './base.repository.js';
import { Slide } from '../models/slide.model.js';

class SlideRepository extends BaseRepository {
  constructor() {
    super(Slide);
  }

  async findAllByShop(shopId, { isActive } = {}) {
    const filter = { shopId };
    if (typeof isActive === 'boolean') {
      filter.isActive = isActive;
    }
    return this.model.find(filter).sort({ createdAt: -1 });
  }
}

export const slideRepository = new SlideRepository();
