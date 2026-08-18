use crate::job_dto::JobKindDto;
use zmanager_core::jobs::JobKind;

impl From<JobKind> for JobKindDto {
    fn from(kind: JobKind) -> Self {
        match kind {
            JobKind::ZipCreate => JobKindDto::ZipCreate,
            JobKind::ZipExtract => JobKindDto::ZipExtract,
            JobKind::SevenZCreate => JobKindDto::SevenZCreate,
            JobKind::SevenZExtract => JobKindDto::SevenZExtract,
            JobKind::RarExtract => JobKindDto::RarExtract,
            JobKind::TarGzCreate => JobKindDto::TarGzCreate,
            JobKind::TarZstdCreate => JobKindDto::TarZstdCreate,
            JobKind::TarZstdExtract => JobKindDto::TarZstdExtract,
            JobKind::TzapCreate => JobKindDto::TzapCreate,
            JobKind::TzapExtract => JobKindDto::TzapExtract,
            JobKind::AppleArchiveCreate => JobKindDto::AppleArchiveCreate,
            JobKind::AppleArchiveExtract => JobKindDto::AppleArchiveExtract,
            JobKind::ArchiveExtract => JobKindDto::ArchiveExtract,
            JobKind::RawStreamExtract => JobKindDto::RawStreamExtract,
        }
    }
}
