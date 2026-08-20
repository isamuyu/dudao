import { Controller, Get } from '@nestjs/common';
import { config } from '../../config';
import {
  BUILDING_GROUPS,
  BUILDING_SUBTYPES,
  DETAILS,
  EXTRA_FACILITIES,
  EXTRA_LEVELS,
  FACILITIES,
  FACILITY_ASPECTS,
  FACILITY_GENERIC,
  MATRIX,
  PARAM_PATCH,
  PARAM_TABLE,
} from '../../checklib/checklib';

/** 检查项库：平台级只读，服务端 checklib.ts 副本直接序列化 */
@Controller('checklib')
export class ChecklibController {
  @Get()
  get() {
    return {
      version: config.checklibVersion,
      facilities: FACILITIES,
      generic: FACILITY_GENERIC,
      groups: BUILDING_GROUPS,
      subtypes: BUILDING_SUBTYPES,
      matrix: MATRIX,
      details: DETAILS,
      aspects: FACILITY_ASPECTS,
      extras: EXTRA_FACILITIES,
      extraLevels: EXTRA_LEVELS,
      paramPatch: PARAM_PATCH,
      paramTable: PARAM_TABLE,
    };
  }
}
