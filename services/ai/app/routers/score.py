from fastapi import APIRouter, Depends

from app.schemas import AuraFeatures, AuraScore, ScoreAggregateRequest
from app.scoring import aggregate_scores, compute_score
from app.security import verify_service_secret

router = APIRouter(dependencies=[Depends(verify_service_secret)])


@router.post("/score", response_model=AuraScore)
def score(features: AuraFeatures) -> AuraScore:
    return compute_score(features)


@router.post("/score/aggregate", response_model=AuraScore)
def score_aggregate(payload: ScoreAggregateRequest) -> AuraScore:
    return aggregate_scores(payload.samples)
