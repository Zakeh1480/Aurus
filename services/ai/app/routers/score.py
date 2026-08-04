from fastapi import APIRouter

from app.schemas import AuraFeatures, AuraScore, ScoreAggregateRequest
from app.scoring import aggregate_scores, compute_score

router = APIRouter()


@router.post("/score", response_model=AuraScore)
def score(features: AuraFeatures) -> AuraScore:
    return compute_score(features)


@router.post("/score/aggregate", response_model=AuraScore)
def score_aggregate(payload: ScoreAggregateRequest) -> AuraScore:
    return aggregate_scores(payload.samples)
