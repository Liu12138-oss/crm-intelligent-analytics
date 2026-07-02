import { Injectable } from '@nestjs/common';
import { DEFAULT_DATA_FRESHNESS_AT } from '../../shared/mock/sample-data';

@Injectable()
export class DataFreshnessService {
  getFreshnessAt(): string {
    return DEFAULT_DATA_FRESHNESS_AT;
  }
}
