import { Injectable } from '@nestjs/common';
import { AppStorageService } from '../../database/app-storage/app-storage.service';
import type {
  AnalysisRequestRecord,
  AnalysisResultRecord,
} from '../../shared/types/domain';

@Injectable()
export class AnalysisRequestRepository {
  constructor(private readonly appStorage: AppStorageService) {}

  saveRequest(record: AnalysisRequestRecord): AnalysisRequestRecord {
    const currentIndex = this.appStorage.state.analysisRequests.findIndex(
      (item) => item.id === record.id,
    );

    if (currentIndex >= 0) {
      this.appStorage.state.analysisRequests[currentIndex] = record;
      this.appStorage.persist();
      return record;
    }

    this.appStorage.state.analysisRequests.unshift(record);
    this.appStorage.persist();
    return record;
  }

  saveResult(result: AnalysisResultRecord): AnalysisResultRecord {
    const currentIndex = this.appStorage.state.analysisResults.findIndex(
      (item) => item.requestId === result.requestId,
    );

    if (currentIndex >= 0) {
      this.appStorage.state.analysisResults[currentIndex] = result;
      this.appStorage.persist();
      return result;
    }

    this.appStorage.state.analysisResults.unshift(result);
    this.appStorage.persist();
    return result;
  }

  findRequestById(queryId: string): AnalysisRequestRecord | undefined {
    return this.appStorage.state.analysisRequests.find((item) => item.id === queryId);
  }

  findResultByRequestId(queryId: string): AnalysisResultRecord | undefined {
    return this.appStorage.state.analysisResults.find(
      (item) => item.requestId === queryId,
    );
  }
}
